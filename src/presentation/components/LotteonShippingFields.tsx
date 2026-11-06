'use client';

import type { OutboundPlace, ReturnCenter } from '@/domain/entities/ShippingEntity';
import {
  LOTTEON_KEYS,
  LOTTEON_LABELS,
  type LotteonChoice,
  type LotteonShippingMap,
} from '@/domain/entities/LotteonShipping';

interface LotteonShippingFieldsProps {
  value: LotteonShippingMap;
  onChange: (next: LotteonShippingMap) => void;
  /** account = the LotteON channel layer · listing = one LotteON listing (there is no master level, D42). */
  level: 'account' | 'listing';
  disabled?: boolean;
  /** LotteON outbound places (150, type 02) — the parent loads them. */
  outbound?: OutboundPlace[];
  /** LotteON return places (150, type 01) — the parent loads them. */
  returns?: ReturnCenter[];
  /** LotteON shipping fee policies (166) — the parent loads them. */
  policies?: LotteonChoice[];
  listsLoading?: boolean;
  /** The channel layer, shown as 「기본값 사용 (현재: …)」 on the listing level. */
  inherited?: LotteonShippingMap;
}

/**
 * LotteON shipping fields — one controlled component shared by the LotteON channel layer and a LotteON listing
 * (FEATURE_2610_24 / D42 · D43 · D65).
 *
 * **Purpose**: the value is one string map of the three `lotteon.*` input keys (`LotteonShippingMap`); the parent owns
 * and saves it. Every choice comes from the LotteON seller center (the seller makes them there, D43).
 * **File**: src/presentation/components/LotteonShippingFields.tsx
 *
 * **Usage**:
 * ```tsx
 * <LotteonShippingFields level="account" value={map} onChange={setMap} outbound={places} returns={returns}
 *   policies={policies} />
 * <LotteonShippingFields level="listing" value={form} onChange={setForm} inherited={baseline} … />
 * ```
 *
 * ⚠️ The policy fee keys (`lotteon.dvCstDvsCd` · `lotteon.dvCst` · `lotteon.cndlFreeStdAmt`) are never shown or edited
 *    here; the server writes them (D65).
 * ❌ Never mixed with the Coupang, 11st or ESM fields — a LotteON channel shows these alone.
 */
export function LotteonShippingFields({
  value,
  onChange,
  level,
  disabled = false,
  outbound = [],
  returns = [],
  policies = [],
  listsLoading = false,
  inherited,
}: LotteonShippingFieldsProps) {
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

  const inheritOption = (display?: string) =>
    level === 'account' ? '선택하세요' : display ? `기본값 사용 (현재: ${display})` : '기본값 사용';

  const renderChoice = (key: string, list: { code: string; name: string }[]) => (
    <div>
      <label className={labelClass}>{LOTTEON_LABELS[key]}</label>
      {listsLoading ? (
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
    <section className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {renderChoice(LOTTEON_KEYS.owhpNo, outbound)}
        {renderChoice(LOTTEON_KEYS.rtrpNo, returns)}
        {renderChoice(LOTTEON_KEYS.dvCstPolNo, policies)}
      </div>
      <p className="text-xs text-gray-500">출고지 · 회수지 · 배송비 정책은 롯데ON 판매자센터에서 만든 것을 고릅니다.</p>
    </section>
  );
}
