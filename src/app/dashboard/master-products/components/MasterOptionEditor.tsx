'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type {
  MasterProductResponse,
  MasterOptionResponse,
  MasterOptionRequest,
  MasterComponent,
} from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

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
  return { name: name.trim(), items, deliveryId, packageId };
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
}: MasterOptionEditorProps) {
  const isEdit = master != null;
  const components = master?.components ?? propComponents ?? [];
  const masterDefaults = masterDefaultsProp ?? {};
  const nameById = new Map(components.map((c) => [c.productId, c.productName]));

  const [showForm, setShowForm] = useState(false);
  // Edit mode: option id. Create mode: array index. null = adding a new option.
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [optName, setOptName] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [optDeliveryId, setOptDeliveryId] = useState<number | ''>('');
  const [optPackageId, setOptPackageId] = useState<number | ''>('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyOptionId, setBusyOptionId] = useState<number | null>(null);

  const seedForm = (
    name: string,
    items: { productId: number; quantity: number }[],
    deliveryId: number | null | undefined,
    packageId: number | null | undefined,
  ) => {
    setOptName(name);
    const byId = new Map(items.map((it) => [it.productId, it.quantity]));
    setQuantities(
      Object.fromEntries(components.map((c) => [c.productId, String(byId.get(c.productId) ?? 1)])),
    );
    setOptDeliveryId(deliveryId ?? masterDefaults.deliveryId ?? '');
    setOptPackageId(packageId ?? masterDefaults.packageId ?? '');
    setFormError('');
    setShowForm(true);
  };

  const openAdd = () => {
    setEditingKey(null);
    seedForm('', [], undefined, undefined);
  };

  const openEditServer = (opt: MasterOptionResponse) => {
    setEditingKey(opt.id);
    seedForm(opt.name, opt.items, opt.deliveryId, opt.packageId);
  };

  const openEditBuffer = (opt: MasterOptionRequest, index: number) => {
    setEditingKey(index);
    seedForm(opt.name, opt.items, opt.deliveryId, opt.packageId);
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
    const payload = normalizeOptionPayload(
      optName,
      components,
      quantities,
      optDeliveryId,
      optPackageId,
      masterDefaults,
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">옵션 (수량조합)</h3>
        <button
          type="button"
          onClick={openAdd}
          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          옵션 추가
        </button>
      </div>

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
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [c.productId]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">택배 override</label>
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
              <label className="mb-1 block text-xs font-medium text-gray-600">상자 override</label>
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
