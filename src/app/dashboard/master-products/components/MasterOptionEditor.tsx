'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type {
  MasterProductResponse,
  MasterOptionResponse,
  MasterOptionRequest,
  MasterComponent,
  CategoryAttribute,
  CategoryNotice,
} from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type { MeasurePair } from '../[id]/components/measureAttributes';
import { CategoryMetaOverrideFields } from '../[id]/components/CategoryMetaOverrideFields';
import { computeMissingOptionRequired } from '../[id]/components/categoryMetaValidation';

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

type StringMapSetter = (updater: (prev: Record<string, string>) => Record<string, string>) => void;

// Sum of an option's component quantities (a missing entry counts as the displayed default 1).
function sumQuantitiesOf(components: MasterComponent[], quantities: Record<number, string>): number {
  return components.reduce((sum, c) => {
    const n = parseInt(quantities[c.productId] ?? '1', 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Auto-reflect the total component quantity into the 수량 category fields (개수 = 포장단위별
 * 수량/총 수량). 중량/용량 필드는 건드리지 않는다(이름에 "수량" 이 든 필드만). 순수 모듈 함수라
 * 이벤트 핸들러와 스키마 로드 effect 양쪽에서 안정적으로 호출된다(안정 참조 → exhaustive-deps 무경고).
 */
function applyQtyToMeta(
  total: number,
  attrs: CategoryAttribute[],
  ntcs: CategoryNotice[],
  setAttr: StringMapSetter,
  setNotice: StringMapSetter,
  // hideCategoryAttrs 이면 속성 fill(수량 속성)만 스킵하고 고시 fill 은 유지한다(값 자체는 비우지 않음).
  hideCategoryAttrs = false,
): void {
  const value = total > 0 ? String(total) : '';
  const attrNames = hideCategoryAttrs
    ? []
    : attrs.filter((a) => a.name.includes('수량')).map((a) => a.name);
  const noticeKeys = ntcs.filter((n) => n.key.includes('수량')).map((n) => n.key);
  if (attrNames.length > 0) {
    setAttr((prev) => {
      const next = { ...prev };
      for (const k of attrNames) next[k] = value;
      return next;
    });
  }
  if (noticeKeys.length > 0) {
    setNotice((prev) => {
      const next = { ...prev };
      for (const k of noticeKeys) next[k] = value;
      return next;
    });
  }
}

/**
 * 옵션 override 페이로드 계산: 빈값 제거 + 마스터값과 동일 key 제거(omit=상속).
 * delivery/package omit 규칙(마스터 기본값과 같으면 생략)을 카테고리 속성/고시에 미러한다.
 */
function diffOverride(
  values: Record<string, string>,
  master: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if ((v ?? '').trim() === '') continue; // empty = inherit master
    if ((v ?? '').trim() === (master[k] ?? '').trim()) continue; // same as master = inherit
    out[k] = v;
  }
  return out;
}

export interface MasterDefaults {
  deliveryId?: number;
  packageId?: number;
}

/**
 * 옵션 폼 상태 → MasterOptionRequest 변환 (create·edit 공용 단일 소스).
 * File: src/app/dashboard/master-products/components/MasterOptionEditor.tsx
 *
 * ⚠️ 택배/상자 override 규칙: `'' → undefined` + **마스터 기본값과 동일하면 omit(상속)**.
 * 마스터 기본값을 명시 복사하지 않아야 마스터 기본값 변경이 옵션에 자동 반영된다.
 */
export function normalizeOptionPayload(
  name: string,
  components: MasterComponent[],
  quantities: Record<number, string>,
  optDeliveryId: number | '',
  optPackageId: number | '',
  masterDefaults: MasterDefaults,
  optAttrValues: Record<string, string> = {},
  optNoticeValues: Record<string, string> = {},
  masterAttrs: Record<string, string> = {},
  masterNotices: Record<string, string> = {},
): MasterOptionRequest {
  const items = components.map((c) => ({
    productId: c.productId,
    quantity: Number(quantities[c.productId]),
  }));
  const deliveryId =
    optDeliveryId === '' || optDeliveryId === masterDefaults.deliveryId
      ? undefined
      : Number(optDeliveryId);
  const packageId =
    optPackageId === '' || optPackageId === masterDefaults.packageId
      ? undefined
      : Number(optPackageId);
  // Category overrides: keep only keys that differ from the master value (empty/same = inherit).
  const categoryAttributes = diffOverride(optAttrValues, masterAttrs);
  const categoryNotices = diffOverride(optNoticeValues, masterNotices);
  return {
    name: name.trim(),
    items,
    deliveryId,
    packageId,
    categoryAttributes: Object.keys(categoryAttributes).length ? categoryAttributes : undefined,
    categoryNotices: Object.keys(categoryNotices).length ? categoryNotices : undefined,
  };
}

interface MasterOptionEditorProps {
  // Edit mode (master present) → 즉시 서버 CRUD.
  master?: MasterProductResponse;
  useCase?: MasterProductUseCase;
  onChanged?: () => Promise<void> | void;
  // Create mode (master absent) → 로컬 버퍼(부모 모달이 소유).
  components?: MasterComponent[];
  options?: MasterOptionRequest[];
  onOptionsChange?: (next: MasterOptionRequest[]) => void;
  // 공통.
  carrierRates: CarrierRate[];
  packages: Package[];
  masterDefaults?: MasterDefaults;
  // Category attribute/notice override (60). categoryId==null hides the override section.
  categoryId?: number | null;
  platform?: string; // default 'COUPANG'
  masterAttrValues?: Record<string, string>; // inherit-diff source (attributes)
  masterNoticeValues?: Record<string, string>; // inherit-diff source (notices)
  // 컨테이너(부모 모달)가 도출해 하달: 옵션-소유 속성 숨김/스킵(값 보존). 수량 자동채움도 속성만 스킵.
  hideCategoryAttrs?: boolean;
  // 옵션 추가/수정 폼이 열려 있는지 부모에 통지 → 부모가 구성상품 편집을 잠금.
  onFormOpenChange?: (open: boolean) => void;
}

/**
 * 옵션 수량조합 편집 (핵심 비즈니스 로직) — 2모드.
 *
 * 옵션 1줄 = 이름 + 마스터 구성상품 전체에 대한 수량 조합.
 * UI 가 항상 전체 구성상품 행을 보여주므로 부분집합(누락) 불가.
 *
 * - **edit 모드**(master 존재): `useCase.addOption/updateOption/deleteOption` 즉시 서버 CRUD.
 * - **create 모드**(master 없음): `options`/`onOptionsChange` 로 부모 버퍼만 편집(서버 호출 없음).
 * - 택배/상자 select 초기값 = 편집 중 override ?? 마스터 기본값(라벨에 `(마스터 기본값)` 표기).
 */
export function MasterOptionEditor({
  master,
  useCase,
  onChanged,
  components: propComponents,
  options,
  onOptionsChange,
  carrierRates,
  packages,
  masterDefaults: masterDefaultsProp,
  categoryId = null,
  platform = 'COUPANG',
  masterAttrValues = {},
  masterNoticeValues = {},
  hideCategoryAttrs = false,
  onFormOpenChange,
}: MasterOptionEditorProps) {
  const isEdit = master != null;
  const components = master?.components ?? propComponents ?? [];
  const masterDefaults = masterDefaultsProp ?? {};
  const nameById = new Map(components.map((c) => [c.productId, c.productName]));

  // Internal use case for schema-only category attribute lookup (getCategorySchema).
  const metaUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );

  const [showForm, setShowForm] = useState(false);
  // Edit mode: option id. Create mode: array index. null = adding a new option.
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [optName, setOptName] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [optDeliveryId, setOptDeliveryId] = useState<number | ''>('');
  const [optPackageId, setOptPackageId] = useState<number | ''>('');
  // Per-option category attribute/notice overrides (60). Empty = inherit master.
  const [optAttrValues, setOptAttrValues] = useState<Record<string, string>>({});
  const [optNoticeValues, setOptNoticeValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyOptionId, setBusyOptionId] = useState<number | null>(null);

  // Category attribute + notice schema (backend-driven). Loaded per category.
  // categoryId==null → override section hidden.
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [notices, setNotices] = useState<CategoryNotice[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrLoadError, setAttrLoadError] = useState('');

  // Latest-value refs so the schema-load effect can reflect the current quantities into the
  // 수량 fields without re-running on every keystroke (would re-fetch the schema).
  const showFormRef = useRef(showForm);
  const quantitiesRef = useRef(quantities);
  const componentsRef = useRef(components);
  const hideCategoryAttrsRef = useRef(hideCategoryAttrs);
  useEffect(() => {
    showFormRef.current = showForm;
    quantitiesRef.current = quantities;
    componentsRef.current = components;
    hideCategoryAttrsRef.current = hideCategoryAttrs;
  });

  // Notify the parent so it can lock component editing while the option form is open.
  useEffect(() => {
    onFormOpenChange?.(showForm);
  }, [showForm, onFormOpenChange]);

  useEffect(() => {
    let alive = true;
    // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      if (categoryId == null) {
        setAttributes([]);
        setNotices([]);
        setAttrLoadError('');
        return;
      }
      setAttrLoading(true);
      setAttrLoadError('');
      try {
        const schema = await metaUseCase.getCategorySchema(categoryId, platform);
        if (!alive) return;
        setAttributes(schema.attributes);
        setNotices(schema.notices);
        // If the option form is already open when the schema arrives (form opened before the
        // async fetch resolved), reflect the current component-quantity total into the 수량
        // fields now — otherwise they stay empty until the user edits a quantity.
        if (showFormRef.current) {
          const total = sumQuantitiesOf(componentsRef.current, quantitiesRef.current);
          applyQtyToMeta(
            total,
            schema.attributes,
            schema.notices,
            setOptAttrValues,
            setOptNoticeValues,
            hideCategoryAttrsRef.current,
          );
        }
      } catch (e) {
        if (!alive) return;
        setAttributes([]);
        setNotices([]);
        setAttrLoadError(
          extractErrorMessage(e, '카테고리 필수속성을 불러오지 못했습니다. override 없이 진행할 수 있습니다.'),
        );
      } finally {
        if (alive) setAttrLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryId, platform, metaUseCase]);

  const sumQuantities = (q: Record<number, string>): number => sumQuantitiesOf(components, q);

  // Auto-reflect the total component quantity into the 수량 category fields (delegates to the
  // pure module helper with the currently-loaded schema).
  const applyItemQtyToMeta = (total: number) =>
    applyQtyToMeta(total, attributes, notices, setOptAttrValues, setOptNoticeValues, hideCategoryAttrs);

  const seedForm = (
    name: string,
    items: { productId: number; quantity: number }[],
    deliveryId: number | null | undefined,
    packageId: number | null | undefined,
    categoryAttributes: Record<string, string> | null | undefined,
    categoryNotices: Record<string, string> | null | undefined,
  ) => {
    setOptName(name);
    const byId = new Map(items.map((it) => [it.productId, it.quantity]));
    const seededQuantities = Object.fromEntries(
      components.map((c) => [c.productId, String(byId.get(c.productId) ?? 1)]),
    );
    setQuantities(seededQuantities);
    setOptDeliveryId(deliveryId ?? masterDefaults.deliveryId ?? '');
    setOptPackageId(packageId ?? masterDefaults.packageId ?? '');
    setOptAttrValues(categoryAttributes ?? {});
    setOptNoticeValues(categoryNotices ?? {});
    // Reflect the initial (default 1 each) quantity total into the 수량 meta fields on open,
    // not only on later edits — layered on top of the seeded values above.
    applyItemQtyToMeta(sumQuantities(seededQuantities));
    setFormError('');
    setShowForm(true);
  };

  const openAdd = () => {
    setEditingKey(null);
    seedForm('', [], undefined, undefined, undefined, undefined);
  };

  const openEditServer = (opt: MasterOptionResponse) => {
    setEditingKey(opt.id);
    seedForm(opt.name, opt.items, opt.deliveryId, opt.packageId, opt.categoryAttributes, opt.categoryNotices);
  };

  const openEditBuffer = (opt: MasterOptionRequest, index: number) => {
    setEditingKey(index);
    seedForm(opt.name, opt.items, opt.deliveryId, opt.packageId, opt.categoryAttributes, opt.categoryNotices);
  };

  // A picked measure unit clears the other side of the pair (only one of weight/volume carries a value).
  const handleOptMeasureUnit = (p: MeasurePair, unit: string) => {
    const clearName = unit === '중량' ? p.volume.name : unit === '용량' ? p.weight.name : '';
    if (clearName) setOptAttrValues((prev) => ({ ...prev, [clearName]: '' }));
  };

  // Component quantity input change → update quantities + re-sum → auto-fill 수량 meta fields.
  const handleQuantityChange = (productId: number, value: string) => {
    const nextQuantities = { ...quantities, [productId]: value };
    setQuantities(nextQuantities);
    applyItemQtyToMeta(sumQuantities(nextQuantities));
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!optName.trim()) {
      setFormError('옵션 이름을 입력하세요.');
      return;
    }
    // 개당 용량/중량·수량 중 **카테고리 스키마가 required 로 표시한 속성**만 옵션 필수(마스터에서 안 받음)
    // → 비어 있으면 저장 차단. 필수 여부는 스키마(쿠팡 메타) 플래그만 따른다(이름 기반 강제 없음).
    if (
      categoryId != null &&
      !attrLoading &&
      computeMissingOptionRequired(attributes, optAttrValues, hideCategoryAttrs)
    ) {
      setFormError('이 옵션의 필수 항목(카테고리가 요구하는 개당 용량/중량·수량)을 입력하세요.');
      return;
    }

    const payload = normalizeOptionPayload(
      optName,
      components,
      quantities,
      optDeliveryId,
      optPackageId,
      masterDefaults,
      optAttrValues,
      optNoticeValues,
      masterAttrValues,
      masterNoticeValues,
    );
    if (payload.items.length === 0) {
      setFormError('구성상품을 먼저 선택하세요.');
      return;
    }
    if (payload.items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1)) {
      setFormError('각 구성상품 수량은 1 이상이어야 합니다.');
      return;
    }

    if (isEdit) {
      setIsSubmitting(true);
      try {
        if (editingKey == null) await useCase!.addOption(master!.id, payload);
        else await useCase!.updateOption(master!.id, editingKey, payload);
        await onChanged?.();
        closeForm();
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setFormError(status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create mode: mutate the parent buffer only (no server call).
    const next = [...(options ?? [])];
    if (editingKey == null) next.push(payload);
    else next[editingKey] = payload;
    onOptionsChange?.(next);
    closeForm();
  };

  const handleDeleteServer = async (opt: MasterOptionResponse) => {
    if (!confirm(`옵션 "${opt.name}" 을(를) 삭제하시겠습니까?`)) return;
    setBusyOptionId(opt.id);
    try {
      await useCase!.deleteOption(master!.id, opt.id);
      await onChanged?.();
    } catch {
      setFormError('옵션 삭제에 실패했습니다.');
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleDeleteBuffer = (index: number) => {
    onOptionsChange?.((options ?? []).filter((_, i) => i !== index));
  };

  const summaryOf = (items: { productId: number; quantity: number; productName?: string }[]) =>
    items
      .map((it) => `${it.productName ?? nameById.get(it.productId) ?? `#${it.productId}`}×${it.quantity}`)
      .join(', ');

  const rows = isEdit
    ? (master?.options ?? []).map((opt) => ({
        key: `s-${opt.id}`,
        name: opt.name,
        summary: summaryOf(opt.items),
        busy: busyOptionId === opt.id,
        onEdit: () => openEditServer(opt),
        onDelete: () => handleDeleteServer(opt),
      }))
    : (options ?? []).map((opt, index) => ({
        key: `b-${index}`,
        name: opt.name,
        summary: summaryOf(opt.items),
        busy: false,
        onEdit: () => openEditBuffer(opt, index),
        onDelete: () => handleDeleteBuffer(index),
      }));

  // Create mode requires both a component set and a category before options can be added.
  // Edit mode's master already carries a category (edited elsewhere), so only components matter.
  const categoryRequired = !isEdit;
  const canAddOption = components.length > 0 && (!categoryRequired || categoryId != null);
  const addBlockedReason =
    components.length === 0
      ? '구성상품을 먼저 선택하면 옵션을 추가할 수 있습니다.'
      : '카테고리를 먼저 선택하면 옵션을 추가할 수 있습니다.';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">옵션</h3>
        <button
          type="button"
          onClick={openAdd}
          disabled={!canAddOption}
          title={canAddOption ? undefined : addBlockedReason}
          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          옵션 추가
        </button>
      </div>

      {!canAddOption && <p className="mb-3 text-[11px] text-amber-700">{addBlockedReason}</p>}

      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">등록된 옵션이 없습니다.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
            >
              <span>
                <span className="font-medium">{row.name}</span>{' '}
                <span className="text-gray-500">({row.summary})</span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={row.onEdit}
                  disabled={row.busy}
                  className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={row.onDelete}
                  disabled={row.busy}
                  className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">
            {editingKey == null ? '옵션 추가' : '옵션 수정'}
          </h4>
          {formError && (
            <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700">{formError}</p>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">옵션 이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700">{c.productName}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  value={quantities[c.productId] ?? '1'}
                  onChange={(e) => handleQuantityChange(c.productId, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">택배비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                value={optDeliveryId}
                onChange={(e) => setOptDeliveryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">마스터 기본값 사용</option>
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.carrier} {r.type} · {formatWon(r.cost)}
                    {r.id === masterDefaults.deliveryId ? ' (마스터 기본값)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">상자비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                value={optPackageId}
                onChange={(e) => setOptPackageId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">마스터 기본값 사용</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type} · {formatWon(p.cost)}
                    {p.id === masterDefaults.packageId ? ' (마스터 기본값)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="col-span-2 text-[11px] text-gray-500">
              비우거나 마스터 기본값과 같으면 마스터 기본 택배/박스를 상속합니다.
            </p>
          </div>

          {categoryId != null && (
            <details open className="mt-3 rounded border border-gray-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                옵션별 설정 — 개당 용량/중량·수량
              </summary>
              <div className="mt-3">
                {attrLoading ? (
                  <div className="flex min-h-16 items-center justify-center">
                    <Spinner size={20} label="불러오는 중..." />
                  </div>
                ) : (
                  <>
                    {attrLoadError && (
                      <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                        {attrLoadError}
                      </p>
                    )}
                    {attributes.length > 0 || notices.length > 0 ? (
                      <>
                        <p className="mb-3 text-[11px] text-gray-500">
                          개당 용량/중량·수량은 옵션마다 다르므로 마스터가 아닌 이 옵션에서 입력합니다.
                          <span className="text-red-600"> *</span> 표시는 카테고리(쿠팡 메타)가 요구하는
                          필수 항목입니다.
                        </p>
                        <CategoryMetaOverrideFields
                          attributes={attributes}
                          notices={notices}
                          attrValues={optAttrValues}
                          noticeValues={optNoticeValues}
                          onAttrChange={(name, value) =>
                            setOptAttrValues((prev) => ({ ...prev, [name]: value }))
                          }
                          onNoticeChange={(key, value) =>
                            setOptNoticeValues((prev) => ({ ...prev, [key]: value }))
                          }
                          onMeasureUnit={handleOptMeasureUnit}
                          disabled={isSubmitting}
                          hideCategoryAttrs={hideCategoryAttrs}
                        />
                      </>
                    ) : (
                      <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        이 카테고리에는 옵션별로 설정할 항목(용량/중량·수량)이 없습니다.
                      </p>
                    )}
                  </>
                )}
              </div>
            </details>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
