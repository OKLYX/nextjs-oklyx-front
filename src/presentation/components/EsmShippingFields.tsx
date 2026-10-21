'use client';

import { useEffect, useState } from 'react';
import type { OutboundPlace, ReturnCenter } from '@/domain/entities/ShippingEntity';
import { ESM_KEYS, ESM_LABELS, type EsmChoice, type EsmShippingMap } from '@/domain/entities/EsmShipping';

interface EsmShippingFieldsProps {
  value: EsmShippingMap;
  onChange: (next: EsmShippingMap) => void;
  /** account = the ESM channel layer · listing = one ESM listing (there is no master level, D36). */
  level: 'account' | 'listing';
  disabled?: boolean;
  /** ESM shipping places (post 17) — the parent loads them. */
  outbound?: OutboundPlace[];
  /** ESM address book entries (post 16) — the parent loads them. */
  returns?: ReturnCenter[];
  /** ESM dispatch policies (post 19) — the parent loads them. */
  dispatches?: EsmChoice[];
  /** ESM couriers (post 142) — the parent loads them. */
  companies?: EsmChoice[];
  listsLoading?: boolean;
  /** The bundle-fee policies of one shipping place (post 18) — asked whenever the effective place changes. */
  loadBundles: (placeNo: string) => Promise<EsmChoice[]>;
  /** The channel layer, shown as 「기본값 사용 (현재: …)」 on the listing level. */
  inherited?: EsmShippingMap;
}

interface BundleEntry {
  placeNo: string;
  list: EsmChoice[];
  failed: boolean;
}

/**
 * ESM (Gmarket · Auction) shipping fields — one controlled component shared by the ESM channel layer and an ESM
 * listing (FEATURE_2610_26 / D35 · D36 · D37).
 *
 * **Purpose**: the value is one string map of the six `esm.*` input keys (`EsmShippingMap`); the parent owns and saves
 * it. Every choice comes from ESM+ (the seller makes them there, D35); only the one-way return fee is typed.
 * **File**: src/presentation/components/EsmShippingFields.tsx
 *
 * **Usage**:
 * ```tsx
 * <EsmShippingFields level="account" value={map} onChange={setMap} outbound={places} returns={addresses}
 *   dispatches={dispatches} companies={companies} loadBundles={(no) => useCase.listEsmBundlePolicies(id, no)} />
 * <EsmShippingFields level="listing" value={form} onChange={setForm} inherited={baseline} … />
 * ```
 *
 * ⚠️ Picking another shipping place clears the bundle-fee policy — a policy belongs to one place (D36).
 * ⚠️ The four policy facts (`esm.bundleFeeType` …) are never edited here; the server writes them (D66).
 * ❌ Never mixed with the Coupang or 11st fields — an ESM channel shows these alone.
 */
export function EsmShippingFields({
  value,
  onChange,
  level,
  disabled = false,
  outbound = [],
  returns = [],
  dispatches = [],
  companies = [],
  listsLoading = false,
  loadBundles,
  inherited,
}: EsmShippingFieldsProps) {
  const base = level === 'account' ? {} : (inherited ?? {});
  const [bundles, setBundles] = useState<BundleEntry | null>(null);

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
  // D36: the bundle-fee policy belongs to the chosen place, so a new place starts without one.
  const setPlace = (raw: string) => {
    const next = { ...value };
    delete next[ESM_KEYS.bundlePolicyNo];
    if (raw.trim() === '') delete next[ESM_KEYS.placeNo];
    else next[ESM_KEYS.placeNo] = raw;
    onChange(next);
  };

  // The place whose policies are listed: the own value, else the inherited one.
  const placeNo = get(ESM_KEYS.placeNo) || base[ESM_KEYS.placeNo] || '';

  useEffect(() => {
    if (placeNo === '') return;
    let alive = true;
    void (async () => {
      try {
        const list = await loadBundles(placeNo);
        if (alive) setBundles({ placeNo, list, failed: false });
      } catch {
        if (alive) setBundles({ placeNo, list: [], failed: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [placeNo, loadBundles]);

  const bundleList = bundles?.placeNo === placeNo ? bundles.list : [];
  const bundlesLoading = placeNo !== '' && bundles?.placeNo !== placeNo;
  const bundlesFailed = bundles?.placeNo === placeNo && bundles.failed;

  const inheritOption = (display?: string) =>
    level === 'account' ? '선택하세요' : display ? `기본값 사용 (현재: ${display})` : '기본값 사용';

  const renderChoice = (
    key: string,
    list: { code: string; name: string }[],
    loading: boolean,
    onPick: (raw: string) => void,
  ) => (
    <div>
      <label className={labelClass}>{ESM_LABELS[key]}</label>
      {loading ? (
        <select disabled className={inputClass}>
          <option>목록을 불러오는 중…</option>
        </select>
      ) : (
        <select
          value={get(key)}
          onChange={(e) => onPick(e.target.value)}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">{inheritOption(list.find((c) => c.code === base[key])?.name ?? base[key])}</option>
          {list.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">출하지 · 배송비</h3>
        <div className="grid grid-cols-2 gap-2">
          {renderChoice(ESM_KEYS.placeNo, outbound, listsLoading, setPlace)}
          {renderChoice(ESM_KEYS.bundlePolicyNo, bundleList, bundlesLoading, (raw) =>
            set(ESM_KEYS.bundlePolicyNo, raw),
          )}
          {renderChoice(ESM_KEYS.dispatchPolicyNo, dispatches, listsLoading, (raw) =>
            set(ESM_KEYS.dispatchPolicyNo, raw),
          )}
        </div>
        {placeNo === '' && <p className="text-xs text-gray-500">출하지를 고르면 그 출하지의 묶음배송비가 보입니다.</p>}
        {bundlesFailed && <p className="text-xs text-red-600">묶음배송비 목록을 불러오지 못했습니다.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">반품/교환</h3>
        <div className="grid grid-cols-2 gap-2">
          {renderChoice(ESM_KEYS.returnAddrNo, returns, listsLoading, (raw) => set(ESM_KEYS.returnAddrNo, raw))}
          {renderChoice(ESM_KEYS.companyNo, companies, listsLoading, (raw) => set(ESM_KEYS.companyNo, raw))}
          <div>
            <label className={labelClass}>{ESM_LABELS[ESM_KEYS.returnFee]}</label>
            <input
              type="number"
              min={0}
              value={get(ESM_KEYS.returnFee)}
              onChange={(e) => set(ESM_KEYS.returnFee, e.target.value)}
              placeholder={base[ESM_KEYS.returnFee]}
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">출하지 · 묶음배송비 · 발송정책 · 주소록은 ESM+ 에서 만든 것을 고릅니다.</p>
      </section>
    </div>
  );
}
