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
import {
  axisOfAttrName,
  findMeasureAttrName,
  hasMeasureAttr,
  readMeasureValue,
} from '../[id]/components/measureAttributes';
import { deriveMeasured, derivedAxis } from '../[id]/components/netContentUnit';
import { composeMeasureNotice, isMeasureNotice } from '../[id]/components/optionNoticeCompose';
import { isTotalQuantityName } from '../[id]/components/optionMetaFields';
import { CategoryMetaOverrideFields } from '../[id]/components/CategoryMetaOverrideFields';
import { computeMissingOptionRequired } from '../[id]/components/categoryMetaValidation';

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

// 옵션 잠금 안내 문구 (85). 잠금 판정은 백엔드 플래그(marketRegistered) 하나만 쓴다.
const LOCKED_ROW_TITLE = '쿠팡에 등록돼 판매 중 — 이름·수량 수정 및 삭제 불가';
const LOCKED_DELETE_REASON = '쿠팡에 등록돼 판매 중 — 삭제할 수 없습니다.';
const LAST_OPTION_DELETE_REASON =
  '옵션은 1개 이상 있어야 합니다. 모든 옵션을 제거하기 위해서는 마스터 상품을 삭제해야 합니다.';

type StringMapSetter = (updater: (prev: Record<string, string>) => Record<string, string>) => void;

// Sum of an option's component quantities (a missing entry counts as the displayed default 1).
function sumQuantitiesOf(components: MasterComponent[], quantities: Record<number, string>): number {
  return components.reduce((sum, c) => {
    const n = parseInt(quantities[c.productId] ?? '1', 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

// 두 dirty Set 을 합친다(폼 열기·스키마 도착의 skip 대상 = touched ∪ seeded).
function unionKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> {
  if (a.size === 0) return b;
  if (b.size === 0) return a;
  return new Set<string>([...a, ...b]);
}

// 값이 비어있지 않은 key 집합(저장값 보호 대상 = seeded).
function filledKeys(map: Record<string, string>): Set<string> {
  return new Set(Object.keys(map).filter((k) => (map[k] ?? '').trim()));
}

/**
 * 구성상품 수량·개당 계량값을 카테고리 필드에 자동 반영하는 **단일 주입 지점**(101).
 * 호출부마다 복제하지 말 것 — 호출부는 값을 계산해 인자로만 넘긴다.
 *
 * - 수량 속성(이름에 "수량"): 구성상품 수량 합. **가드 없음**(수량 합이 SSOT).
 * - 개당 계량 속성(중량/용량): `measured` 를 `axis` 쪽 속성 하나에만. `skipAttrs` 로 보호.
 * - 계량 고시(수량 ∩ 계량): `${measured} ${total}개` 로 조합. `skipNotices` 로 보호.
 * - 수량 전용 고시: 수량 합(현행 유지, 가드 없음).
 *
 * 순수 모듈 함수라 이벤트 핸들러와 스키마 로드 effect 양쪽에서 안정적으로 호출된다
 * (안정 참조 → exhaustive-deps 무경고).
 *
 * ⚠️ `attrValues` 를 넘겨받아 여기서 읽지 않는다 — `seedForm` 에서는 setState 가 아직 반영되지
 * 않아 항상 빈 값이 된다. 유효 계량값(`measured`)은 **호출부가 계산해** 넘긴다.
 */
function applyQtyToMeta(
  total: number,
  attrs: CategoryAttribute[],
  ntcs: CategoryNotice[],
  setAttr: StringMapSetter,
  setNotice: StringMapSetter,
  // hideCategoryAttrs 이면 속성 fill(수량·계량 속성)만 스킵하고 고시 fill 은 유지한다(값 자체는 비우지 않음).
  hideCategoryAttrs = false,
  // D7 유효 계량값(단위 포함, 예 `320g`). 빈 값이면 계량 속성·계량 고시를 채우지 않는다.
  measured = '',
  // 도출된 축. 이 축의 속성 하나에만 주입한다(반대쪽은 건드리지 않는다).
  axis: '중량' | '용량' | '' = '',
  skipAttrs: ReadonlySet<string> = EMPTY_KEYS,
  skipNotices: ReadonlySet<string> = EMPTY_KEYS,
): void {
  const value = total > 0 ? String(total) : '';
  // 계량 고시를 자동 조합으로 소유하는가 = 조합 소스(개당 계량 속성)가 있고 속성을 보내는 구성인가.
  // 혼합구성(AB)·계량 속성 없는 카테고리는 조합이 불가하므로 사용자 입력 필드로 남긴다.
  const autoMeasureNotice = !hideCategoryAttrs && hasMeasureAttr(attrs);
  const attrNames = hideCategoryAttrs
    ? []
    : attrs.filter((a) => isTotalQuantityName(a.name)).map((a) => a.name);
  const measureName =
    !hideCategoryAttrs && measured && axis ? findMeasureAttrName(attrs, axis) : '';
  const injectMeasure = measureName !== '' && !skipAttrs.has(measureName);
  if (attrNames.length > 0 || injectMeasure) {
    setAttr((prev) => {
      const next = { ...prev };
      for (const k of attrNames) next[k] = value; // 수량 속성 — 가드 없음
      if (injectMeasure) next[measureName] = measured;
      return next;
    });
  }
  // 계량 고시 키도 "수량" 을 포함하므로 isMeasureNotice 를 먼저 본다(if/else 순서 유지).
  const composed = composeMeasureNotice(measured, total);
  const noticeTargets = ntcs.filter(
    (n) => isMeasureNotice(n.key) || isTotalQuantityName(n.key),
  );
  if (noticeTargets.length > 0) {
    setNotice((prev) => {
      const next = { ...prev };
      for (const n of noticeTargets) {
        if (isMeasureNotice(n.key)) {
          if (autoMeasureNotice) {
            // 조합 소스가 있으면 계량 고시는 **파생값**이다(화면에서도 읽기 전용) → dirty 가드 없이
            // 항상 덮어쓰고, 조합이 불가능해지면(개당 값을 비우면) **비운다**. 비워야 97 게이트가
            // 막아서 낡은 문자열이 그대로 마켓까지 가는 걸 방지한다.
            next[n.key] = composed;
          } else if (composed && !skipNotices.has(n.key)) {
            // 조합 불가(혼합구성 AB · 계량 속성 없는 카테고리) = 사용자 입력 필드 → 기존 가드 유지.
            // ⚠️ skip 은 이 분기 안에서만 — 루프 앞에서 continue 하면 수량 전용 고시까지 막힌다.
            next[n.key] = composed;
          }
        } else {
          next[n.key] = value;
        }
      }
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
  // 마스터가 저장/선택한 실효 품목군(부모가 submitNoticeGroup 으로 도출). 옵션 고시 노출·검증 범위.
  masterNoticeGroup?: string | null;
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
  masterNoticeGroup = null,
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
  // 자동채움 보호 대상 2종(101 D5). 출처가 달라 분리해 들고 있어야 D6/D7 이 동시에 성립한다.
  // touched* = 이번 세션에 사용자가 직접 고친 key → 어떤 자동채움도 이긴다(항상 보호).
  // seeded*  = 폼을 열 때 저장값이 있던 key → 폼 열기·스키마 도착에서만 보호(수량 변경엔 양보).
  // ⚠️ "현재값이 조합 결과와 같은가" 로 판정하지 말 것 — 우연히 같은 값을 입력한 경우와 구분이
  // 안 되고, 조합 규칙이 바뀌면 판정이 통째로 흔들린다.
  const [touchedAttrs, setTouchedAttrs] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const [touchedNotices, setTouchedNotices] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const [seededAttrKeys, setSeededAttrKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const [seededNoticeKeys, setSeededNoticeKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const [formError, setFormError] = useState('');
  // 목록 레벨 에러(삭제 실패 등). formError 는 {showForm && ...} 안에서만 렌더되므로 폼이 닫힌
  // 상태에서 일어나는 목록 액션 에러는 반드시 이 채널로 보여준다.
  const [listError, setListError] = useState('');
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
  const attrValuesRef = useRef(optAttrValues);
  const touchedAttrsRef = useRef(touchedAttrs);
  const touchedNoticesRef = useRef(touchedNotices);
  const seededAttrKeysRef = useRef(seededAttrKeys);
  const seededNoticeKeysRef = useRef(seededNoticeKeys);
  useEffect(() => {
    showFormRef.current = showForm;
    quantitiesRef.current = quantities;
    componentsRef.current = components;
    hideCategoryAttrsRef.current = hideCategoryAttrs;
    attrValuesRef.current = optAttrValues;
    touchedAttrsRef.current = touchedAttrs;
    touchedNoticesRef.current = touchedNotices;
    seededAttrKeysRef.current = seededAttrKeys;
    seededNoticeKeysRef.current = seededNoticeKeys;
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
          // 계량 속성 이름은 스키마가 도착해야 정해지므로 이 경로도 반드시 자동채움을 돌린다.
          // 유효 계량값 = 저장/입력된 값 ?? 구성상품 물품에서 도출(D7).
          const comps = componentsRef.current;
          const total = sumQuantitiesOf(comps, quantitiesRef.current);
          const measured =
            readMeasureValue(schema.attributes, attrValuesRef.current) || deriveMeasured(comps);
          applyQtyToMeta(
            total,
            schema.attributes,
            schema.notices,
            setOptAttrValues,
            setOptNoticeValues,
            hideCategoryAttrsRef.current,
            measured,
            derivedAxis(comps),
            unionKeys(touchedAttrsRef.current, seededAttrKeysRef.current),
            unionKeys(touchedNoticesRef.current, seededNoticeKeysRef.current),
          );
        }
      } catch (e) {
        if (!alive) return;
        setAttributes([]);
        setNotices([]);
        setAttrLoadError(
          extractErrorMessage(e, '카테고리 필수속성을 불러오지 못했습니다. 옵션별 값을 지정하지 않고 진행할 수 있습니다.'),
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

  /**
   * 수량·개당 계량값 자동채움(현재 로드된 스키마로 모듈 헬퍼에 위임).
   *
   * @param values 유효 계량값을 읽을 속성 값 맵. ⚠️ state 가 아니라 **호출부가 가진 값**을 넘긴다
   *   (`seedForm` 에서는 setState 가 아직 반영되지 않아 state 를 읽으면 항상 빈 값).
   * @param skipAttrs 폼 열기/스키마 도착 = `touched ∪ seeded`, 수량 변경 = `touched` 만(D7).
   */
  const applyItemQtyToMeta = (
    total: number,
    o: {
      values: Record<string, string>;
      skipAttrs: ReadonlySet<string>;
      skipNotices: ReadonlySet<string>;
    },
  ) => {
    const measured = readMeasureValue(attributes, o.values) || deriveMeasured(components);
    applyQtyToMeta(
      total,
      attributes,
      notices,
      setOptAttrValues,
      setOptNoticeValues,
      hideCategoryAttrs,
      measured,
      derivedAxis(components),
      o.skipAttrs,
      o.skipNotices,
    );
  };

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
    const seededAttrs = categoryAttributes ?? {};
    const seededNotices = categoryNotices ?? {};
    setOptAttrValues(seededAttrs);
    setOptNoticeValues(seededNotices);
    const seededA = filledKeys(seededAttrs);
    const seededN = filledKeys(seededNotices);
    setTouchedAttrs(EMPTY_KEYS); // 새 폼 = 사용자 편집 이력 초기화
    setTouchedNotices(EMPTY_KEYS);
    setSeededAttrKeys(seededA); // 저장값 보호(수량 변경에는 양보)
    setSeededNoticeKeys(seededN);
    // 수량·개당 계량값을 열 때도 반영하되 **저장값은 덮어쓰지 않는다**(101 D7 — 종전엔 저장 직후
    // 무조건 덮어써 고쳐 저장한 값이 재진입 때마다 사라졌다). 비운 필드는 seeded 에 없으므로
    // 다음 진입에서 다시 도출된다(되돌리는 법 = 필드를 비운다).
    applyItemQtyToMeta(sumQuantities(seededQuantities), {
      values: seededAttrs,
      skipAttrs: seededA,
      skipNotices: seededN,
    });
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
    // ⚠️ 축을 고른 것도 사용자 편집이다 — **페어 양쪽 모두** 보호하지 않으면 다음 자동채움이
    // 반대쪽(weight)에 재주입하고, 화면은 선택된 축만 렌더하므로 **안 보이는 값이 payload 로 나간다**.
    setTouchedAttrs((prev) => new Set([...prev, p.weight.name, p.volume.name]));
  };

  /**
   * 옵션 속성 편집. 계량 속성(개당 중량/용량)이 바뀌면 **계량 고시를 다시 조합한다** —
   * 고시 문자열(`320g 3개`)은 이 값 + 수량으로 만든 파생값이므로 소스가 바뀌면 따라와야 한다
   * (단위를 g→kg 로 바꿨는데 고시에 `320g` 이 남으면 속성과 고시가 어긋난 채 마켓까지 간다).
   *
   * ⚠️ 사용자가 **고시를 직접 고쳤으면**(`touchedNotices`) 그 값이 이긴다 — 수량 변경과 같은 규칙(D5).
   * 대신 그 세션에서 고시에 덧붙인 텍스트는 계량값을 바꾸면 사라진다(D7 수량 선례와 동형).
   * ⚠️ 방금 편집한 속성 자체는 `skipAttrs` 로 보호한다(자동채움이 되덮으면 타이핑이 되돌아간다).
   */
  const handleAttrChange = (name: string, value: string) => {
    const nextValues = { ...optAttrValues, [name]: value };
    setOptAttrValues(nextValues);
    setTouchedAttrs((prev) => (prev.has(name) ? prev : new Set([...prev, name])));
    if (axisOfAttrName(name)) {
      applyItemQtyToMeta(sumQuantities(quantities), {
        values: nextValues,
        skipAttrs: new Set([...touchedAttrs, name]),
        skipNotices: touchedNotices,
      });
    }
  };

  // Component quantity input change → update quantities + re-sum → auto-fill 수량 meta fields.
  const handleQuantityChange = (productId: number, value: string) => {
    const nextQuantities = { ...quantities, [productId]: value };
    setQuantities(nextQuantities);
    // 수량이 SSOT 라 계량 고시는 재조합한다(저장값 보호 = touched 만, seeded 는 양보 — D7).
    applyItemQtyToMeta(sumQuantities(nextQuantities), {
      values: optAttrValues,
      skipAttrs: touchedAttrs,
      skipNotices: touchedNotices,
    });
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
    // 옵션-소유 필드 중 **카테고리 스키마가 required 로 표시한 것**(속성 + 선택 품목군의 고시)이
    // 비어 있으면 저장 차단 — 백엔드 96 과 같은 규칙으로 먼저 막는다. 필수 여부는 스키마(쿠팡 메타)
    // 플래그만 따른다(이름 기반 강제 없음). 고시는 마스터 값 상속도 충족으로 본다.
    if (
      categoryId != null &&
      !attrLoading &&
      computeMissingOptionRequired(attributes, optAttrValues, hideCategoryAttrs, {
        notices,
        optNoticeValues,
        masterNoticeValues,
        noticeGroup: masterNoticeGroup,
      })
    ) {
      setFormError('이 옵션의 필수 항목(카테고리가 요구하는 속성·고시)을 입력하세요.');
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
        // 84 의 400 사유(잠긴 옵션 수정·이름 중복 등)를 그대로 노출한다. 일괄 문구로 덮으면
        // 사용자가 이유를 알 수 없다.
        setFormError(
          extractErrorMessage(e, status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.'),
        );
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
    setListError('');
    setBusyOptionId(opt.id);
    try {
      await useCase!.deleteOption(master!.id, opt.id);
      await onChanged?.();
    } catch (e: unknown) {
      setListError(extractErrorMessage(e, '옵션 삭제에 실패했습니다.'));
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

  // 마스터의 마지막 옵션은 삭제 불가(옵션 >= 1 불변식, 84 가 서버에서도 강제).
  const isLastServerOption = isEdit && (master?.options.length ?? 0) <= 1;

  const rows = isEdit
    ? (master?.options ?? []).map((opt) => {
        const locked = opt.marketRegistered === true;
        return {
          key: `s-${opt.id}`,
          name: opt.name,
          summary: summaryOf(opt.items),
          busy: busyOptionId === opt.id,
          locked,
          deleteBlockedReason: locked
            ? LOCKED_DELETE_REASON
            : isLastServerOption
              ? LAST_OPTION_DELETE_REASON
              : undefined,
          onEdit: () => openEditServer(opt),
          onDelete: () => handleDeleteServer(opt),
        };
      })
    : (options ?? []).map((opt, index) => ({
        key: `b-${index}`,
        name: opt.name,
        summary: summaryOf(opt.items),
        busy: false,
        // 생성 모드(버퍼 옵션)는 어디에도 등록돼 있지 않다 → 잠금 없음.
        locked: false,
        deleteBlockedReason: undefined as string | undefined,
        onEdit: () => openEditBuffer(opt, index),
        onDelete: () => handleDeleteBuffer(index),
      }));

  // 목록 아래 보이는 안내 1줄 — disabled 버튼은 툴팁이 안 뜨는 브라우저가 있어 문구를 함께 둔다.
  // 사유가 여러 개면 하나만: locked 우선, 없으면 마지막-옵션.
  const listBlockedReason =
    rows.find((r) => r.locked)?.deleteBlockedReason ??
    rows.find((r) => r.deleteBlockedReason)?.deleteBlockedReason ??
    '';

  // 편집 중인 옵션의 잠금(수량·이름 입력 잠금). 옵션 추가(editingKey == null)는 절대 잠기지 않는다.
  const lockedEditing =
    isEdit &&
    editingKey != null &&
    master?.options.find((o) => o.id === editingKey)?.marketRegistered === true;

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

      {listError && (
        <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700">{listError}</p>
      )}

      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">등록된 옵션이 없습니다.</p>
      ) : (
        <ul className="mb-1 space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
            >
              <span>
                <span className="font-medium">{row.name}</span>{' '}
                {row.locked && (
                  <span className="mr-1" title={LOCKED_ROW_TITLE}>
                    🔒
                  </span>
                )}
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
                  disabled={row.busy || row.deleteBlockedReason != null}
                  title={row.deleteBlockedReason}
                  className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {listBlockedReason && <p className="mb-3 text-[11px] text-amber-700">{listBlockedReason}</p>}

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">
            {editingKey == null ? '옵션 추가' : '옵션 수정'}
            {lockedEditing && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                🔒 쿠팡 판매 중
              </span>
            )}
          </h4>
          {formError && (
            <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700">{formError}</p>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">옵션 이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
              disabled={lockedEditing}
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
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                  value={quantities[c.productId] ?? '1'}
                  onChange={(e) => handleQuantityChange(c.productId, e.target.value)}
                  disabled={lockedEditing}
                />
              </div>
            ))}
          </div>
          {lockedEditing && (
            <p className="mt-2 text-[11px] text-amber-700">
              쿠팡에 등록된 옵션이라 이름·수량은 바꿀 수 없습니다. 다른 조합이 필요하면 옵션을 새로
              추가하세요(이름은 달라야 합니다).
            </p>
          )}
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
              비우거나 마스터 기본값과 같으면 마스터 기본 택배/박스를 그대로 사용합니다.
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
                          onAttrChange={(name, value) => handleAttrChange(name, value)}
                          onNoticeChange={(key, value) => {
                            setOptNoticeValues((prev) => ({ ...prev, [key]: value }));
                            setTouchedNotices((prev) =>
                              prev.has(key) ? prev : new Set([...prev, key]),
                            );
                          }}
                          onMeasureUnit={handleOptMeasureUnit}
                          disabled={isSubmitting}
                          hideCategoryAttrs={hideCategoryAttrs}
                          noticeGroup={masterNoticeGroup}
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
