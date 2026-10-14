'use client';

import type { OutboundPlace, ReturnCenter } from '@/domain/entities/ShippingEntity';
import {
  ELEVENST_AREA_OPTIONS,
  ELEVENST_BUNDLE_OPTIONS,
  ELEVENST_COD_NOTICE_OPTIONS,
  ELEVENST_FEE_TYPE_OPTIONS,
  ELEVENST_KEYS,
  ELEVENST_MAX_TIERS,
  ELEVENST_METHOD_OPTIONS,
  ELEVENST_PAY_TYPE_OPTIONS,
  ELEVENST_RETURN_FEE_METHOD_OPTIONS,
  tierError,
  tiersOf,
  withTiers,
  type CodeOption,
  type ElevenstShippingMap,
  type ElevenstTier,
} from '@/domain/entities/ElevenstShipping';
import { useCarrierOptions } from '@/presentation/hooks/useCarrierOptions';
import type { ShippingOverrideLevel } from './ShippingOverrideFields';

interface ElevenstShippingFieldsProps {
  value: ElevenstShippingMap;
  onChange: (next: ElevenstShippingMap) => void;
  /** account = the 11st channel default · master = master override (no address numbers) · listing = one listing. */
  level: ShippingOverrideLevel;
  disabled?: boolean;
  /** 11st outbound addresses (1014) — the parent loads them; not used on the master level. */
  outbound?: OutboundPlace[];
  /** 11st return/exchange addresses (1015) — the parent loads them; not used on the master level. */
  returns?: ReturnCenter[];
  placesLoading?: boolean;
  /** Inherited baseline shown as 「기본값 사용 (현재: …)」 / placeholder on the master and listing levels. */
  inherited?: ElevenstShippingMap;
}

/**
 * 11st shipping fields — one controlled component shared by the 11st channel default, the master and an 11st
 * listing (FEATURE_2610_13 / D84 · D91 · D106).
 *
 * **Purpose**: the value is one string map of `elevenst.*` keys (`ElevenstShippingMap`); the parent owns and saves it.
 * **File**: src/presentation/components/ElevenstShippingFields.tsx
 *
 * **Usage**:
 * ```tsx
 * <ElevenstShippingFields level="account" value={map} onChange={setMap} outbound={outbound} returns={returns} />
 * <ElevenstShippingFields level="master" value={elevenstMap} onChange={setElevenstMap} />
 * <ElevenstShippingFields level="listing" value={form} onChange={setForm} inherited={baseline} outbound={outbound} returns={returns} />
 * ```
 *
 * ⚠️ A blank value = 「기본값 사용」 (master · listing). The account level is the base and inherits nothing.
 * ⚠️ The outbound and return/exchange addresses are 11st address numbers of one account — hidden on `level="master"` (D85).
 * ❌ Never mixed with the Coupang fields (`ShippingOverrideFields`) — there is no shared field (D105).
 */
export function ElevenstShippingFields({
  value,
  onChange,
  level,
  disabled = false,
  outbound = [],
  returns = [],
  placesLoading = false,
  inherited,
}: ElevenstShippingFieldsProps) {
  const { carriers, loading: carriersLoading } = useCarrierOptions('ELEVENST');
  const showPlaces = level !== 'master';
  const base = level === 'account' ? {} : (inherited ?? {});

  const inputClass =
    'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';
  const labelClass = 'block text-sm font-medium mb-1';

  const get = (key: string) => value[key] ?? '';
  const set = (key: string, raw: string) => {
    const next = { ...value };
    if (raw.trim() === '') delete next[key];
    else next[key] = raw;
    onChange(next);
  };

  const labelOf = (opts: CodeOption[], code: string | undefined) =>
    code == null || code === '' ? undefined : (opts.find((o) => o.value === code)?.label ?? code);
  const inheritOption = (display?: string) =>
    level === 'account' ? '선택하세요' : display ? `기본값 사용 (현재: ${display})` : '기본값 사용';

  const renderSelect = (label: string, key: string, opts: CodeOption[]) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        value={get(key)}
        onChange={(e) => set(key, e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">{inheritOption(labelOf(opts, base[key]))}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderAmount = (label: string, key: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="number"
        min={0}
        value={get(key)}
        onChange={(e) => set(key, e.target.value)}
        placeholder={base[key]}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  );

  const renderPlace = (label: string, key: string, places: { code: string; name: string }[]) => (
    <div>
      <label className={labelClass}>{label}</label>
      {placesLoading ? (
        <select disabled className={inputClass}>
          <option>목록을 불러오는 중…</option>
        </select>
      ) : (
        <select
          value={get(key)}
          onChange={(e) => set(key, e.target.value)}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">
            {inheritOption(places.find((p) => p.code === base[key])?.name ?? base[key])}
          </option>
          {places.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // Fee type / pay type as they will apply (own value, else inherited) — decides which amount fields show.
  const feeType = get(ELEVENST_KEYS.feeType) || base[ELEVENST_KEYS.feeType] || '';
  const payType = get(ELEVENST_KEYS.payType) || base[ELEVENST_KEYS.payType] || '';
  const method = get(ELEVENST_KEYS.method) || base[ELEVENST_KEYS.method] || '';

  const tiers = tiersOf(value);
  const setTiers = (next: ElevenstTier[]) => onChange(withTiers(value, next));
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const start = last == null ? '1' : /^\d+$/.test(last.end.trim()) ? String(Number(last.end) + 1) : '';
    setTiers([...tiers, { start, end: '', fee: '' }]);
  };
  const updateTier = (index: number, patch: Partial<ElevenstTier>) =>
    setTiers(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  const removeTier = (index: number) => setTiers(tiers.filter((_, i) => i !== index));
  const tierMessage = tierError(value);

  return (
    <div className="space-y-5">
      {showPlaces && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">출고지 · 반품/교환지</h3>
          <div className="grid grid-cols-2 gap-2">
            {renderPlace('출고지', ELEVENST_KEYS.outboundSeq, outbound)}
            {renderPlace('반품/교환지', ELEVENST_KEYS.returnSeq, returns)}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">배송</h3>
        <div className="grid grid-cols-2 gap-2">
          {renderSelect('배송 가능 지역', ELEVENST_KEYS.areaCode, ELEVENST_AREA_OPTIONS)}
          {renderSelect('배송 방법', ELEVENST_KEYS.method, ELEVENST_METHOD_OPTIONS)}
          {method === '01' && (
            <div>
              <label className={labelClass}>택배사</label>
              {carriersLoading ? (
                <select disabled className={inputClass}>
                  <option>택배사를 불러오는 중…</option>
                </select>
              ) : (
                <select
                  value={get(ELEVENST_KEYS.courier)}
                  onChange={(e) => set(ELEVENST_KEYS.courier, e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                >
                  <option value="">
                    {inheritOption(
                      carriers.find((c) => c.deliveryCompanyCode === base[ELEVENST_KEYS.courier])?.carrierName ??
                        base[ELEVENST_KEYS.courier],
                    )}
                  </option>
                  {carriers.map((c) => (
                    <option key={c.deliveryCompanyCode} value={c.deliveryCompanyCode}>
                      {c.carrierName} ({c.deliveryCompanyCode})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {renderSelect('묶음배송', ELEVENST_KEYS.bundle, ELEVENST_BUNDLE_OPTIONS)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">배송비</h3>
        <div className="grid grid-cols-2 gap-2">
          {renderSelect('배송비 종류', ELEVENST_KEYS.feeType, ELEVENST_FEE_TYPE_OPTIONS)}
          {renderSelect('결제 방법', ELEVENST_KEYS.payType, ELEVENST_PAY_TYPE_OPTIONS)}
          {(feeType === '02' || feeType === '03') && renderAmount('배송비', ELEVENST_KEYS.fee)}
          {feeType === '03' && renderAmount('무료배송 기준 금액', ELEVENST_KEYS.freeOver)}
          {feeType === '05' && renderAmount('1개당 배송비', ELEVENST_KEYS.perItemFee)}
          {feeType === '02' &&
            payType === '02' &&
            renderSelect('착불 안내', ELEVENST_KEYS.codNotice, ELEVENST_COD_NOTICE_OPTIONS)}
        </div>
        {(feeType === '07' || feeType === '08') && (
          <p className="text-xs text-gray-500">금액은 11번가 셀러오피스에 설정한 값을 따릅니다.</p>
        )}
        {feeType === '04' && (
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-700">수량별 배송비 (최대 10구간)</p>
            {tiers.length === 0 && level !== 'account' && (
              <p className="text-xs text-gray-500">구간을 넣지 않으면 기본값을 그대로 씁니다.</p>
            )}
            {tiers.map((tier, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={1}
                  value={tier.start}
                  onChange={(e) => updateTier(index, { start: e.target.value })}
                  disabled={disabled}
                  className={inputClass}
                  aria-label={`${index + 1}구간 시작 수량`}
                />
                <span className="shrink-0 text-gray-600">개 이상</span>
                {index < tiers.length - 1 ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={tier.end}
                      onChange={(e) => updateTier(index, { end: e.target.value })}
                      disabled={disabled}
                      className={inputClass}
                      aria-label={`${index + 1}구간 끝 수량`}
                    />
                    <span className="shrink-0 text-gray-600">개 이하</span>
                  </>
                ) : (
                  <span className="shrink-0 text-gray-400">상한 없음</span>
                )}
                <input
                  type="number"
                  min={0}
                  value={tier.fee}
                  onChange={(e) => updateTier(index, { fee: e.target.value })}
                  disabled={disabled}
                  className={inputClass}
                  aria-label={`${index + 1}구간 배송비`}
                />
                <span className="shrink-0 text-gray-600">원</span>
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  disabled={disabled}
                  className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTier}
              disabled={disabled || tiers.length >= ELEVENST_MAX_TIERS}
              className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              구간 추가
            </button>
            {tierMessage && <p className="text-xs text-red-600">{tierMessage}</p>}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">추가 배송비 · 반품/교환</h3>
        <div className="grid grid-cols-2 gap-2">
          {renderAmount('제주 추가 배송비', ELEVENST_KEYS.jejuFee)}
          {renderAmount('도서산간 추가 배송비', ELEVENST_KEYS.islandFee)}
          {renderAmount('반품 배송비(편도)', ELEVENST_KEYS.returnFee)}
          {renderAmount('교환 배송비(왕복)', ELEVENST_KEYS.exchangeFee)}
          {renderSelect('반품비 부과 방법', ELEVENST_KEYS.returnFeeMethod, ELEVENST_RETURN_FEE_METHOD_OPTIONS)}
        </div>
        <p className="text-xs text-gray-500">반품비 부과 방법을 비우면 11번가가 정합니다.</p>
      </section>
    </div>
  );
}
