// ESM (Gmarket · Auction) shipping settings (FEATURE_2610_26 / D36 · D37 · D60 · D66). One string map with `esm.*`
// keys at both levels: the ESM channel layer (its own table) and an ESM listing override. There is no master level.
// Mirrors the backend `EsmShippingKeys` — keep the two in step.

export type EsmShippingMap = Record<string, string>;

export const ESM_PREFIX = 'esm.';

/** D36: the six values a person picks or types, in screen order. */
export const ESM_KEYS = {
  placeNo: 'esm.placeNo',
  bundlePolicyNo: 'esm.bundlePolicyNo',
  dispatchPolicyNo: 'esm.dispatchPolicyNo',
  returnAddrNo: 'esm.returnAddrNo',
  companyNo: 'esm.companyNo',
  returnFee: 'esm.returnFee',
} as const;

export const ESM_INPUT_KEYS: string[] = Object.values(ESM_KEYS);

/** D36: the screen labels of the six values (fields and summary rows). */
export const ESM_LABELS: Record<string, string> = {
  [ESM_KEYS.placeNo]: '출하지',
  [ESM_KEYS.bundlePolicyNo]: '묶음배송비',
  [ESM_KEYS.dispatchPolicyNo]: '발송정책',
  [ESM_KEYS.returnAddrNo]: '반품/교환지',
  [ESM_KEYS.companyNo]: '택배사',
  [ESM_KEYS.returnFee]: '반품 배송비(편도)',
};

/** One pickable ESM value (`GET …/esm-shipping/*`): `code` is stored, `name` is shown (D37 · D68). */
export interface EsmChoice {
  code: string;
  name: string;
}

/** Stored ESM channel layer (`GET` / `PUT …/esm-shipping-config`). Nothing stored = empty map. */
export interface EsmShippingConfig {
  marketplaceAccountId: number;
  settings: EsmShippingMap;
  /** D65: ESM listings of this channel whose re-price failed after a save (0 on a read). */
  priceRecalcFailedCount?: number;
}

/** D66 (listing level): the place and the bundle-fee policy are set together or left together. */
export const ESM_PAIR_MESSAGE = '출하지와 묶음배송비는 함께 고르세요';

/** The six input keys with a non-blank value, trimmed — the server writes the policy keys itself (D66). */
export function cleanEsmMap(map: EsmShippingMap | null | undefined): EsmShippingMap {
  const out: EsmShippingMap = {};
  ESM_INPUT_KEYS.forEach((key) => {
    const value = map?.[key];
    if (value != null && value.trim() !== '') out[key] = value.trim();
  });
  return out;
}

/** D36: true when one of the six input keys is still empty (= shipping not set). */
export function esmShippingUnset(map: EsmShippingMap | null | undefined): boolean {
  const clean = cleanEsmMap(map);
  return ESM_INPUT_KEYS.some((key) => clean[key] == null);
}

/** Pre-fill an ESM listing form: the listing's own value wins per key, otherwise the channel layer. */
export function mergeEsmPreset(own: EsmShippingMap, base: EsmShippingMap): EsmShippingMap {
  return { ...cleanEsmMap(base), ...cleanEsmMap(own) };
}

/**
 * The listing override to save: the keys that differ from the channel layer — the place and the bundle-fee policy go
 * together when either differs (D66).
 */
export function diffEsm(form: EsmShippingMap, base: EsmShippingMap): EsmShippingMap {
  const cleanForm = cleanEsmMap(form);
  const cleanBase = cleanEsmMap(base);
  const out: EsmShippingMap = {};
  Object.entries(cleanForm).forEach(([key, value]) => {
    if (cleanBase[key] !== value) out[key] = value;
  });
  const pairChanged = out[ESM_KEYS.placeNo] != null || out[ESM_KEYS.bundlePolicyNo] != null;
  if (pairChanged) {
    if (cleanForm[ESM_KEYS.placeNo] != null) out[ESM_KEYS.placeNo] = cleanForm[ESM_KEYS.placeNo];
    if (cleanForm[ESM_KEYS.bundlePolicyNo] != null) {
      out[ESM_KEYS.bundlePolicyNo] = cleanForm[ESM_KEYS.bundlePolicyNo];
    }
  }
  return out;
}

/** D66 save check of a listing override: null = fine. */
export function esmPairError(override: EsmShippingMap): string | null {
  const place = override[ESM_KEYS.placeNo] != null;
  const bundle = override[ESM_KEYS.bundlePolicyNo] != null;
  return place === bundle ? null : ESM_PAIR_MESSAGE;
}
