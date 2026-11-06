// LotteON shipping settings (FEATURE_2610_24 / D42 · D43 · D65). One string map with `lotteon.*` keys at both levels:
// the LotteON channel layer (its own table) and a LotteON listing override. There is no master level.
// Mirrors the backend `LotteonShippingKeys` — keep the two in step.

export type LotteonShippingMap = Record<string, string>;

export const LOTTEON_PREFIX = 'lotteon.';

/** D42: the three numbers a person picks, in screen order. */
export const LOTTEON_KEYS = {
  owhpNo: 'lotteon.owhpNo',
  rtrpNo: 'lotteon.rtrpNo',
  dvCstPolNo: 'lotteon.dvCstPolNo',
} as const;

export const LOTTEON_INPUT_KEYS: string[] = Object.values(LOTTEON_KEYS);

/** D42: the screen labels of the three numbers (fields and summary rows). */
export const LOTTEON_LABELS: Record<string, string> = {
  [LOTTEON_KEYS.owhpNo]: '출고지',
  [LOTTEON_KEYS.rtrpNo]: '회수지',
  [LOTTEON_KEYS.dvCstPolNo]: '배송비 정책',
};

/** One pickable LotteON shipping fee policy (`GET …/lotteon-shipping/fee-policies`): `code` is stored, `name` is shown. */
export interface LotteonChoice {
  code: string;
  name: string;
}

/** Stored LotteON channel layer (`GET` / `PUT …/lotteon-shipping-config`). Nothing stored = empty map. */
export interface LotteonShippingConfig {
  marketplaceAccountId: number;
  settings: LotteonShippingMap;
  /** D66: LotteON listings of this channel whose re-price failed after a save (0 on a read). */
  priceRecalcFailedCount?: number;
}

/** The three input keys with a non-blank value, trimmed — the server writes the policy fee keys itself (D65). */
export function cleanLotteonMap(map: LotteonShippingMap | null | undefined): LotteonShippingMap {
  const out: LotteonShippingMap = {};
  LOTTEON_INPUT_KEYS.forEach((key) => {
    const value = map?.[key];
    if (value != null && value.trim() !== '') out[key] = value.trim();
  });
  return out;
}

/** D42: true when one of the three input keys is still empty (= shipping not set). */
export function lotteonShippingUnset(map: LotteonShippingMap | null | undefined): boolean {
  const clean = cleanLotteonMap(map);
  return LOTTEON_INPUT_KEYS.some((key) => clean[key] == null);
}

/** Pre-fill a LotteON listing form: the listing's own value wins per key, otherwise the channel layer. */
export function mergeLotteonPreset(own: LotteonShippingMap, base: LotteonShippingMap): LotteonShippingMap {
  return { ...cleanLotteonMap(base), ...cleanLotteonMap(own) };
}

/** The listing override to save: the input keys that differ from the channel layer. */
export function diffLotteon(form: LotteonShippingMap, base: LotteonShippingMap): LotteonShippingMap {
  const cleanForm = cleanLotteonMap(form);
  const cleanBase = cleanLotteonMap(base);
  const out: LotteonShippingMap = {};
  Object.entries(cleanForm).forEach(([key, value]) => {
    if (cleanBase[key] !== value) out[key] = value;
  });
  return out;
}
