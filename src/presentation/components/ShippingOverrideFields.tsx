'use client';

import { useState } from 'react';
import type {
  OutboundPlace,
  ReturnCenter,
  ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import { OutboundPlacePickerModal } from './OutboundPlacePickerModal';
import { ReturnCenterPickerModal } from './ReturnCenterPickerModal';

// Coupang product-creation enums (backend 73 register payload SSOT).
const DELIVERY_METHODS = [
  { value: 'SEQUENCIAL', label: '일반배송' },
  { value: 'COLD_FRESH', label: '신선냉동' },
  { value: 'MAKE_ORDER', label: '주문제작' },
  { value: 'AGENT_BUY', label: '구매대행' },
  { value: 'VENDOR_DIRECT', label: '설치/직접전달' },
];
const DELIVERY_CHARGE_TYPES = [
  { value: 'FREE', label: '무료배송' },
  { value: 'NOT_FREE', label: '유료배송' },
  { value: 'CHARGE_RECEIVED', label: '착불' },
  { value: 'CONDITIONAL_FREE', label: '조건부 무료' },
];

// deliveryMethod values that surface the extraInfoMessage input (주문제작 / 설치배송).
const EXTRA_INFO_METHODS = new Set(['MAKE_ORDER', 'VENDOR_DIRECT']);

// Buyer-facing extra-info presets (주문제작/설치배송). Front-side constants —
// server-managed presets are out of scope (75). Phrases confirmed 2026-08-27.
const EXTRA_INFO_PRESETS = [
  '주문 후 제작되는 상품으로, 발송까지 영업일 기준 3~5일이 소요됩니다.',
  '설치 배송 상품으로, 배송기사가 방문하여 설치해 드립니다.',
  '주문 제작 상품으로 단순 변심에 의한 교환·반품이 제한될 수 있습니다.',
];
const CUSTOM_MESSAGE = '__custom__';

/**
 * 쿠팡 택배사 코드(deliveryCompanyCode)는 조회 API 가 없는 정적 표(공식 문서, ~150개).
 * 사용자는 코드를 모르므로 이름으로 고르게 하고 코드를 대신 저장/전송한다.
 * 출처: https://developers.coupang.com/hc/en-us/articles/360034156033-Courier-Code
 *
 * ⚠️ 클레임 회수송장 등록(`ClaimActionPanel`)도 이 목록을 **공유**한다 — 사본을 만들면 두 화면이
 * 다른 택배사를 보여주게 된다. 백엔드에도 같은 성격의 표(`CoupangCourierCodes`, 198개)가 있고
 * 그쪽이 전송 전 화이트리스트 검증을 하므로, 여기 목록은 그 부분집합이어야 한다.
 * TODO: 두 표(프론트 큐레이션 16 / 백엔드 전량 198)를 한 원천으로 합치는 것은 후속 리팩터링
 * (사용자 결정 2026-09-05 — 지금은 프론트 상수 공유로 간다).
 */
export const COUPANG_DELIVERY_COMPANIES: { code: string; name: string }[] = [
  { code: 'CJGLS', name: 'CJ대한통운' },
  { code: 'HANJIN', name: '한진택배' },
  // ⚠️ 롯데는 코드가 2개다 — 공식 표에 `HYUNDAI`·`LOTTEGLOBAL` 이 **둘 다** "Lotte Global Logistics"
  // 로 등재돼 있다(`HYUNDAI` 는 현대택배 시절 코드가 그대로 남은 것). 계정마다 매칭되는 쪽이 달라
  // 하나만 넣으면 "내 택배사가 목록에 없다"가 된다(실계정 확인 2026-08-30: WING 매칭은 `HYUNDAI`).
  // 이름에 코드를 병기해 사용자가 자기 계정 값을 고르게 한다. 기존 저장값(LOTTEGLOBAL)도 계속
  // 인식돼야 하므로 **둘 다 유지**할 것 — 목록에 없는 코드는 "직접 입력" 으로 떨어진다.
  { code: 'HYUNDAI', name: '롯데택배 (HYUNDAI)' },
  { code: 'LOTTEGLOBAL', name: '롯데택배 (LOTTEGLOBAL)' },
  { code: 'KGB', name: '로젠택배' },
  { code: 'EPOST', name: '우체국택배' },
  { code: 'KDEXP', name: '경동택배' },
  { code: 'ILYANG', name: '일양로지스' },
  { code: 'CHUNIL', name: '천일택배' },
  { code: 'DAESIN', name: '대신택배' },
  { code: 'CVS', name: '편의점택배(CVSnet)' },
  { code: 'SLX', name: 'SLX택배' },
  { code: 'HONAM', name: '우리택배(호남)' },
  { code: 'CSLOGIS', name: 'SC로지스' },
  { code: 'AJOU', name: '아주택배' },
  { code: 'HILOGIS', name: '하이로지스' },
  { code: 'EMS', name: '우체국 EMS' },
];

const MANUAL_CARRIER = '__manual__';

/** Curated per-platform carrier list; empty = free-text fallback (other platforms). */
export function deliveryCompaniesFor(platform: string): { code: string; name: string }[] {
  return platform === 'COUPANG' ? COUPANG_DELIVERY_COMPANIES : [];
}

export type ShippingOverrideLevel = 'account' | 'master' | 'listing';

interface ShippingOverrideFieldsProps {
  value: ShippingOverride;
  onChange: (next: ShippingOverride) => void;
  /**
   * account = 74 계정 기본값(상속 개념 없는 base). master = 마스터 override
   * (출고지/반품지 숨김 — 계정별 센터라 마스터 override 불가). listing = 채널 override.
   */
  level: ShippingOverrideLevel;
  /** COUPANG 택배사 큐레이션 분기용. 없으면 자유입력. */
  platform?: string;
  disabled?: boolean;
  /** 출고지 피커 옵션 (level ≠ master 에서 부모가 조회해 주입). */
  outbound?: OutboundPlace[];
  /** 반품지 피커 옵션 (level ≠ master 에서 부모가 조회해 주입). */
  returns?: ReturnCenter[];
  /**
   * 상속 baseline (master ?? account) — 비운 필드에 placeholder 로 표시(백엔드 resolver SSOT, 76).
   * 프론트는 이 값을 표시만 하고 3단 해석을 재구현하지 않는다. master 레벨은 계정마다 달라 미주입.
   */
  inherited?: ShippingOverride;
  /** 출고지/반품지 조회 로딩 표시 (level ≠ master). */
  placesLoading?: boolean;
  /**
   * 렌더 범위. 기본 `'full'` = 그 level 이 허용하는 전 필드.
   *
   * `'common'` = **마스터 생성 폼 전용** — 전 채널에 공통으로 미리 정해두면 편한 배송설정만
   * (도서산간·택배사·배송비 유형[+기본배송비/무료기준]·묶음배송·배송방법). 출고지/반품지·반품 배송비·
   * 추가 안내문구는 제외한다: 앞의 둘은 계정마다 값이 달라야 하고(사용자 결정 2026-08-28), 뒤의 둘은
   * 생성 직후 마스터 상세의 [배송 설정 (전 채널)] 패널에서 지정한다.
   */
  scope?: 'full' | 'common';
}

/**
 * 배송 override 편집 공용 controlled 컴포넌트 (계정 기본값 74 / 마스터 override 75 / 채널 override 75).
 *
 * **용도**: 배송관리(74) 전 필드(택배사·배송방법·배송비유형/기본배송비/무료기준·묶음배송·도서산간·반품배송비·출고지/반품지)
 * + extraInfoMessage(주문제작/설치배송 시)를 한 컴포넌트로 편집. 74 계정 모달·마스터 패널·채널 모달이 재사용한다(중복 렌더 금지).
 *
 * **파일**: src/presentation/components/ShippingOverrideFields.tsx
 *
 * **override 시맨틱**: 비운 필드 = 상속(master/listing). enum/토글의 빈값 = 상속. account 는 상속 개념 없는 base.
 * 값은 백엔드 override Map(문자열)과 라운드트립되므로 저장 시 부모가 overrideToMap 으로 직렬화한다(이 컴포넌트는 타입 편집만).
 *
 * ⚠️ **level 로 출고지·반품지 노출 제어**: account/listing = 출고지/반품지 피커 노출(74 피커 재사용, `outbound`/`returns` 주입).
 * `master` = 출고지/반품지 숨김(계정별 센터라 마스터 override 불가, 백엔드도 조용히 무시). 택배사·나머지는 전 level 공통.
 *
 * **controlled 규칙**: 값은 부모가 소유(`value`/`onChange`). 피커 열림/직접입력 토글만 내부 UI state(set-state-in-effect 없음).
 */
export function ShippingOverrideFields({
  value,
  onChange,
  level,
  platform,
  disabled = false,
  outbound = [],
  returns = [],
  inherited,
  placesLoading = false,
  scope = 'full',
}: ShippingOverrideFieldsProps) {
  const isCommon = scope === 'common';
  const showPlaces = level !== 'master' && !isCommon;
  const companies = deliveryCompaniesFor(platform ?? '');

  // UI-only state (not value): manual carrier code entry, custom message entry, picker open.
  const [manualCarrier, setManualCarrier] = useState(false);
  const [customMessage, setCustomMessage] = useState(false);
  const [outboundPickerOpen, setOutboundPickerOpen] = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);

  const setField = <K extends keyof ShippingOverride>(key: K, val: ShippingOverride[K]) => {
    onChange({ ...value, [key]: val });
  };
  const numberField = (key: keyof ShippingOverride, raw: string) =>
    setField(key, raw === '' ? null : Number(raw));

  const applyOutbound = (place: OutboundPlace) => {
    setField('outboundShippingPlaceCode', place.code);
  };
  const applyReturnCenter = (center: ReturnCenter) => {
    onChange({
      ...value,
      returnCenterCode: center.code,
      returnChargeName: center.name,
      returnContactNumber: center.contactNumber,
      returnZipCode: center.zipCode,
      returnAddress: center.address,
      returnAddressDetail: center.addressDetail,
      returnCharge: center.returnCharge,
      deliveryChargeOnReturn: center.deliveryChargeOnReturn,
    });
  };

  const inputClass =
    'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';
  const labelClass = 'block text-sm font-medium mb-1';

  // Inherited-value display helpers (76): shown as the "기본값 사용" option label / placeholder / hint so
  // the user sees what applies when a field is left blank. account level has no inheritance.
  const labelOf = (opts: { value: string; label: string }[], v: string | null) =>
    v == null ? undefined : opts.find((o) => o.value === v)?.label ?? v;
  const carrierName = (code: string | null | undefined) =>
    code == null ? undefined : companies.find((c) => c.code === code)?.name ?? code;
  const numStr = (n: number | null | undefined) => (n == null ? undefined : String(n));
  const ynLabel = (v: string | null | undefined) =>
    v === 'Y' ? '가능' : v === 'N' ? '불가' : undefined;
  const unionLabel = (v: string | null | undefined) =>
    v === 'UNION_DELIVERY' ? '가능' : v === 'NOT_UNION_DELIVERY' ? '불가' : undefined;
  // Fallback-option label. UI wording: "기본값 사용" (never 상속/override — user-facing copy, 2026-08-28).
  const inheritOptionOf = (display?: string) =>
    level === 'account'
      ? '선택하세요'
      : display
        ? `기본값 사용 (현재: ${display})`
        : '기본값 사용';

  const renderToggle = (
    label: string,
    current: string | null,
    options: { value: string; label: string }[],
    onSelect: (v: string) => void,
    inheritedHint?: string,
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(current === o.value ? '' : o.value)}
            disabled={disabled}
            className={`flex-1 px-2 py-2 border rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
              current === o.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {level !== 'account' && current == null && inheritedHint && (
        <p className="mt-1 text-xs text-gray-400">기본값: {inheritedHint}</p>
      )}
    </div>
  );

  const returnRoundTrip = (value.deliveryChargeOnReturn ?? 0) + (value.returnCharge ?? 0);
  const outboundName = outbound.find((p) => p.code === value.outboundShippingPlaceCode)?.name;

  // Place fields have no "(현재: X)" select option to fall back on, so when this level leaves them
  // blank we render the inherited place as a card instead of collapsing to an empty picker button —
  // otherwise "기본값 사용" looks like "미지정". account level has no inheritance.
  const inheritedOutboundCode =
    level === 'account' ? null : (inherited?.outboundShippingPlaceCode ?? null);
  const inheritedOutboundName = outbound.find((p) => p.code === inheritedOutboundCode)?.name;
  const inheritedReturnCode = level === 'account' ? null : (inherited?.returnCenterCode ?? null);
  const inheritedReturnEntry = returns.find((r) => r.code === inheritedReturnCode);
  const inheritedReturnName =
    inherited?.returnChargeName || inheritedReturnEntry?.chargeName || inheritedReturnEntry?.name;
  const inheritedReturnAddressLine = [
    inherited?.returnZipCode ? `[${inherited.returnZipCode}]` : (inheritedReturnEntry?.zipCode ? `[${inheritedReturnEntry.zipCode}]` : ''),
    inherited?.returnAddress ?? inheritedReturnEntry?.address ?? '',
    inherited?.returnAddressDetail ?? inheritedReturnEntry?.addressDetail ?? '',
  ]
    .filter((p) => p && p.trim())
    .join(' ')
    .trim();
  const returnAddressLine = [
    value.returnZipCode ? `[${value.returnZipCode}]` : '',
    value.returnAddress ?? '',
    value.returnAddressDetail ?? '',
  ]
    .filter((p) => p && p.trim())
    .join(' ')
    .trim();

  // extraInfoMessage select state (derived + local customMessage flag).
  const currentMessage = value.extraInfoMessage ?? '';
  const isPreset = EXTRA_INFO_PRESETS.includes(currentMessage);
  const showCustomInput = customMessage || (currentMessage !== '' && !isPreset);
  const messageSelectValue = showCustomInput ? CUSTOM_MESSAGE : isPreset ? currentMessage : '';
  const showExtraInfo = EXTRA_INFO_METHODS.has(value.deliveryMethod ?? '');

  // Delivery-company select: a stored code not in the curated list opens manual entry.
  const codeInList = companies.some((c) => c.code === value.deliveryCompanyCode);
  const showManualCarrier =
    manualCarrier || (companies.length > 0 && !!value.deliveryCompanyCode && !codeInList);

  return (
    <>
      <div className="space-y-5">
        {/* Outbound place (account / listing only) */}
        {showPlaces && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">출고지</h3>
            {placesLoading ? (
              <p className="text-xs text-gray-500">출고지 목록을 불러오는 중...</p>
            ) : outbound.length > 0 ? (
              value.outboundShippingPlaceCode ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-gray-900">
                      {outboundName || value.outboundShippingPlaceCode}
                    </p>
                    {outboundName && (
                      <p className="truncate text-xs text-gray-500">{value.outboundShippingPlaceCode}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setOutboundPickerOpen(true)}
                      disabled={disabled}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      변경
                    </button>
                    {level !== 'account' && (
                      <button
                        type="button"
                        onClick={() => setField('outboundShippingPlaceCode', null)}
                        disabled={disabled}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        기본값 사용
                      </button>
                    )}
                  </div>
                </div>
              ) : inheritedOutboundCode ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-gray-500">기본값 사용</p>
                    <p className="truncate font-medium text-gray-700">
                      {inheritedOutboundName || inheritedOutboundCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOutboundPickerOpen(true)}
                    disabled={disabled}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    직접 지정
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOutboundPickerOpen(true)}
                    disabled={disabled}
                    className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    출고지 선택
                  </button>
                  {level !== 'account' && inherited && (
                    <p className="text-xs text-gray-500">판매자에 지정된 기본 출고지가 없습니다.</p>
                  )}
                </>
              )
            ) : (
              <input
                type="text"
                value={value.outboundShippingPlaceCode ?? ''}
                onChange={(e) => setField('outboundShippingPlaceCode', e.target.value || null)}
                placeholder={inherited?.outboundShippingPlaceCode ?? '출고지 코드를 직접 입력하세요'}
                disabled={disabled}
                className={inputClass}
              />
            )}
          </section>
        )}

        {/* Delivery settings */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">배송설정</h3>
          <div className="grid grid-cols-2 gap-2">
            {renderToggle(
              '도서산간 배송',
              value.remoteAreaDeliverable,
              [
                { value: 'Y', label: '가능' },
                { value: 'N', label: '불가' },
              ],
              (v) => setField('remoteAreaDeliverable', v || null),
              ynLabel(inherited?.remoteAreaDeliverable),
            )}
            <div>
              <label className={labelClass}>택배사</label>
              {companies.length > 0 ? (
                <>
                  <select
                    value={showManualCarrier ? MANUAL_CARRIER : value.deliveryCompanyCode ?? ''}
                    onChange={(e) => {
                      if (e.target.value === MANUAL_CARRIER) {
                        setManualCarrier(true);
                      } else {
                        setManualCarrier(false);
                        setField('deliveryCompanyCode', e.target.value || null);
                      }
                    }}
                    disabled={disabled}
                    className={inputClass}
                  >
                    <option value="">{inheritOptionOf(carrierName(inherited?.deliveryCompanyCode))}</option>
                    {companies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                    <option value={MANUAL_CARRIER}>직접 입력…</option>
                  </select>
                  {showManualCarrier && (
                    <input
                      type="text"
                      value={value.deliveryCompanyCode ?? ''}
                      onChange={(e) => setField('deliveryCompanyCode', e.target.value || null)}
                      placeholder={inherited?.deliveryCompanyCode ?? '쿠팡 택배사 코드 (예: KDEXP)'}
                      disabled={disabled}
                      className={`${inputClass} mt-1`}
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={value.deliveryCompanyCode ?? ''}
                  onChange={(e) => setField('deliveryCompanyCode', e.target.value || null)}
                  placeholder={inherited?.deliveryCompanyCode ?? '택배사 코드를 직접 입력하세요'}
                  disabled={disabled}
                  className={inputClass}
                />
              )}
            </div>
            <div>
              <label className={labelClass}>배송비 유형</label>
              <select
                value={value.deliveryChargeType ?? ''}
                onChange={(e) => setField('deliveryChargeType', e.target.value || null)}
                disabled={disabled}
                className={inputClass}
              >
                <option value="">
                  {inheritOptionOf(labelOf(DELIVERY_CHARGE_TYPES, inherited?.deliveryChargeType ?? null))}
                </option>
                {DELIVERY_CHARGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {renderToggle(
              '묶음배송',
              value.unionDeliveryType,
              [
                { value: 'UNION_DELIVERY', label: '가능' },
                { value: 'NOT_UNION_DELIVERY', label: '불가' },
              ],
              (v) => setField('unionDeliveryType', v || null),
              unionLabel(inherited?.unionDeliveryType),
            )}
            {(value.deliveryChargeType === 'NOT_FREE' ||
              value.deliveryChargeType === 'CONDITIONAL_FREE') && (
              <div>
                <label className={labelClass}>기본배송비</label>
                <input
                  type="number"
                  value={value.deliveryCharge ?? ''}
                  onChange={(e) => numberField('deliveryCharge', e.target.value)}
                  placeholder={numStr(inherited?.deliveryCharge)}
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
            )}
            {value.deliveryChargeType === 'CONDITIONAL_FREE' && (
              <div>
                <label className={labelClass}>무료배송 기준금액</label>
                <input
                  type="number"
                  value={value.freeShipOverAmount ?? ''}
                  onChange={(e) => numberField('freeShipOverAmount', e.target.value)}
                  placeholder={numStr(inherited?.freeShipOverAmount) ?? '이 금액 이상 무료'}
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* 배송방법 = 배송비 유형 하단, 추가 안내문구 = 배송방법 옆 (주문제작/설치배송 시). */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>배송방법</label>
              <select
                value={value.deliveryMethod ?? ''}
                onChange={(e) => setField('deliveryMethod', e.target.value || null)}
                disabled={disabled}
                className={inputClass}
              >
                <option value="">
                  {inheritOptionOf(labelOf(DELIVERY_METHODS, inherited?.deliveryMethod ?? null))}
                </option>
                {DELIVERY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {showExtraInfo && !isCommon && (
              <div>
                <label className={labelClass}>추가 안내문구</label>
                <select
                  value={messageSelectValue}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_MESSAGE) {
                      setCustomMessage(true);
                    } else {
                      setCustomMessage(false);
                      setField('extraInfoMessage', e.target.value || null);
                    }
                  }}
                  disabled={disabled}
                  className={inputClass}
                >
                  <option value="">{level === 'account' ? '사용 안 함' : '기본값 사용'}</option>
                  {EXTRA_INFO_PRESETS.map((preset, i) => (
                    <option key={preset} value={preset}>
                      {`프리셋 ${i + 1} — ${preset}`}
                    </option>
                  ))}
                  <option value={CUSTOM_MESSAGE}>직접 입력…</option>
                </select>
                {showCustomInput && (
                  <textarea
                    value={value.extraInfoMessage ?? ''}
                    onChange={(e) => setField('extraInfoMessage', e.target.value || null)}
                    placeholder={inherited?.extraInfoMessage ?? '구매자에게 노출할 안내문구를 입력하세요'}
                    rows={2}
                    maxLength={500}
                    disabled={disabled}
                    className={`${inputClass} mt-1`}
                  />
                )}
                <p className="mt-1 text-xs text-gray-500">
                  주문제작·설치배송 상품에서 구매자에게 노출됩니다.
                </p>
              </div>
            )}
          </div>

          {/* 묶음배송+착불 동시 지정은 백엔드 register 400 가드 (75) — 안내. */}
          {value.unionDeliveryType === 'UNION_DELIVERY' &&
            value.deliveryChargeType === 'CHARGE_RECEIVED' && (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                묶음배송(가능)과 착불은 동시에 지정할 수 없습니다. 등록 시 오류가 발생합니다.
              </p>
            )}
        </section>

        {/* Return center (account / listing only) */}
        {showPlaces && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">반품지</h3>
            {placesLoading ? (
              <p className="text-xs text-gray-500">반품지 목록을 불러오는 중...</p>
            ) : returns.length > 0 ? (
              value.returnCenterCode ? (
                <div className="flex items-start justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-gray-900">
                      {value.returnChargeName || value.returnCenterCode}
                    </p>
                    {returnAddressLine && (
                      <p className="break-keep text-xs text-gray-600">{returnAddressLine}</p>
                    )}
                    {value.returnContactNumber && (
                      <p className="truncate text-xs text-gray-500">{value.returnContactNumber}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnPickerOpen(true)}
                      disabled={disabled}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      변경
                    </button>
                    {level !== 'account' && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...value,
                            returnCenterCode: null,
                            returnChargeName: null,
                            returnContactNumber: null,
                            returnZipCode: null,
                            returnAddress: null,
                            returnAddressDetail: null,
                          })
                        }
                        disabled={disabled}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        기본값 사용
                      </button>
                    )}
                  </div>
                </div>
              ) : inheritedReturnCode ? (
                <div className="flex items-start justify-between gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-gray-500">기본값 사용</p>
                    <p className="truncate font-medium text-gray-700">
                      {inheritedReturnName || inheritedReturnCode}
                    </p>
                    {inheritedReturnAddressLine && (
                      <p className="break-keep text-xs text-gray-600">{inheritedReturnAddressLine}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReturnPickerOpen(true)}
                    disabled={disabled}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    직접 지정
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setReturnPickerOpen(true)}
                    disabled={disabled}
                    className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    반품지 선택
                  </button>
                  {level !== 'account' && inherited && (
                    <p className="text-xs text-gray-500">판매자에 지정된 기본 반품지가 없습니다.</p>
                  )}
                </>
              )
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={value.returnCenterCode ?? ''}
                  onChange={(e) => setField('returnCenterCode', e.target.value || null)}
                  placeholder="반품지 코드 (미생성 시 NO_RETURN_CENTERCODE)"
                  disabled={disabled}
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>반품지명</label>
                    <input
                      type="text"
                      value={value.returnChargeName ?? ''}
                      onChange={(e) => setField('returnChargeName', e.target.value || null)}
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>연락처</label>
                    <input
                      type="text"
                      value={value.returnContactNumber ?? ''}
                      onChange={(e) => setField('returnContactNumber', e.target.value || null)}
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>우편번호</label>
                    <input
                      type="text"
                      value={value.returnZipCode ?? ''}
                      onChange={(e) => setField('returnZipCode', e.target.value || null)}
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>주소</label>
                    <input
                      type="text"
                      value={value.returnAddress ?? ''}
                      onChange={(e) => setField('returnAddress', e.target.value || null)}
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>상세 주소</label>
                    <input
                      type="text"
                      value={value.returnAddressDetail ?? ''}
                      onChange={(e) => setField('returnAddressDetail', e.target.value || null)}
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Return-leg fees (master + listing key — shown at all levels) */}
        {!isCommon && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">반품 배송비</h3>
          <div className="rounded-md border border-gray-200 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>초도배송(편도)</label>
                <input
                  type="number"
                  value={value.deliveryChargeOnReturn ?? ''}
                  onChange={(e) => numberField('deliveryChargeOnReturn', e.target.value)}
                  placeholder={numStr(inherited?.deliveryChargeOnReturn)}
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>반품배송비(편도)</label>
                <input
                  type="number"
                  value={value.returnCharge ?? ''}
                  onChange={(e) => numberField('returnCharge', e.target.value)}
                  placeholder={numStr(inherited?.returnCharge)}
                  disabled={disabled}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed break-keep">
              고객 사유로 인한 반품 시, 왕복 반품·배송비는{' '}
              <span className="font-bold text-red-600">
                초도배송비 + 반품배송비의 합계인 {returnRoundTrip.toLocaleString('ko-KR')}원
              </span>
              이 청구됩니다.
            </p>
          </div>
        </section>
        )}
      </div>

      {showPlaces && (
        <>
          <OutboundPlacePickerModal
            isOpen={outboundPickerOpen}
            places={outbound}
            selectedCode={value.outboundShippingPlaceCode}
            onSelect={applyOutbound}
            onClose={() => setOutboundPickerOpen(false)}
          />
          <ReturnCenterPickerModal
            isOpen={returnPickerOpen}
            centers={returns}
            selectedCode={value.returnCenterCode}
            onSelect={applyReturnCenter}
            onClose={() => setReturnPickerOpen(false)}
          />
        </>
      )}
    </>
  );
}
