// Shipping management (FEATURE_2608_06 / 72·74): per-account outbound/return
// lookup + a single shipping config. All fields nullable — the backend allows
// partial saves and the register flow (73) guards missing required values.

/** Outbound shipping place (platform lookup). */
export interface OutboundPlace {
  code: string;
  name: string;
}

/** Return center with its full address block (platform lookup). */
export interface ReturnCenter {
  code: string;
  name: string;
  chargeName: string | null;
  contactNumber: string | null;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  returnCharge: number | null;
  deliveryChargeOnReturn: number | null;
}

/** Stored shipping config for one account (GET response). */
export interface ShippingConfig {
  marketplaceAccountId: number | null;
  outboundShippingPlaceCode: string | null;
  returnCenterCode: string | null;
  returnChargeName: string | null;
  returnContactNumber: string | null;
  returnZipCode: string | null;
  returnAddress: string | null;
  returnAddressDetail: string | null;
  returnCharge: number | null;
  deliveryChargeOnReturn: number | null;
  deliveryMethod: string | null;
  deliveryCompanyCode: string | null;
  deliveryChargeType: string | null;
  deliveryCharge: number | null;
  freeShipOverAmount: number | null;
  remoteAreaDeliverable: string | null;
  unionDeliveryType: string | null;
  // 주문제작/설치배송 시 구매자에게 노출되는 추가 안내문구 (backend 75). optional.
  extraInfoMessage: string | null;
}

/** Upsert request body (PUT). Same shape as ShippingConfig minus the account id. */
export interface ShippingConfigRequest {
  outboundShippingPlaceCode: string | null;
  returnCenterCode: string | null;
  returnChargeName: string | null;
  returnContactNumber: string | null;
  returnZipCode: string | null;
  returnAddress: string | null;
  returnAddressDetail: string | null;
  returnCharge: number | null;
  deliveryChargeOnReturn: number | null;
  deliveryMethod: string | null;
  deliveryCompanyCode: string | null;
  deliveryChargeType: string | null;
  deliveryCharge: number | null;
  freeShipOverAmount: number | null;
  remoteAreaDeliverable: string | null;
  unionDeliveryType: string | null;
  extraInfoMessage: string | null;
}

// ---------------------------------------------------------------------------
// Shipping override (FEATURE_2608_06 / 75): master (all channels) / channel
// (this listing) override of the account default. Each field null/blank =
// inherit (the backend 3-level resolver decides). Same field set as the
// account config so ShippingOverrideFields can edit account / master / listing
// with one component. `master` level never carries the place keys (outbound /
// return center) — those centers are per-account (backend filterMaster drops
// them anyway; the UI simply hides them).
// ---------------------------------------------------------------------------
export interface ShippingOverride {
  outboundShippingPlaceCode: string | null;
  returnCenterCode: string | null;
  returnChargeName: string | null;
  returnContactNumber: string | null;
  returnZipCode: string | null;
  returnAddress: string | null;
  returnAddressDetail: string | null;
  returnCharge: number | null;
  deliveryChargeOnReturn: number | null;
  deliveryMethod: string | null;
  deliveryCompanyCode: string | null;
  deliveryChargeType: string | null;
  deliveryCharge: number | null;
  freeShipOverAmount: number | null;
  remoteAreaDeliverable: string | null;
  unionDeliveryType: string | null;
  extraInfoMessage: string | null;
}

export const EMPTY_SHIPPING_OVERRIDE: ShippingOverride = {
  outboundShippingPlaceCode: null,
  returnCenterCode: null,
  returnChargeName: null,
  returnContactNumber: null,
  returnZipCode: null,
  returnAddress: null,
  returnAddressDetail: null,
  returnCharge: null,
  deliveryChargeOnReturn: null,
  deliveryMethod: null,
  deliveryCompanyCode: null,
  deliveryChargeType: null,
  deliveryCharge: null,
  freeShipOverAmount: null,
  remoteAreaDeliverable: null,
  unionDeliveryType: null,
  extraInfoMessage: null,
};

// Numeric override keys — parsed to number on prefill, sent as strings on save.
const NUMERIC_OVERRIDE_KEYS: (keyof ShippingOverride)[] = [
  'returnCharge',
  'deliveryChargeOnReturn',
  'deliveryCharge',
  'freeShipOverAmount',
];

/**
 * Outbound place / return center keys — the account's own registered centers. Force-apply never
 * touches them and they never make a channel "diverge" from the master (the master cannot hold them).
 * Mirrors the backend `ShippingOverrideKeys.PLACE_KEYS` (75/79).
 */
export const PLACE_OVERRIDE_KEYS: string[] = [
  'outboundShippingPlaceCode',
  'returnCenterCode',
  'returnChargeName',
  'returnContactNumber',
  'returnZipCode',
  'returnAddress',
  'returnAddressDetail',
];

/**
 * Does this channel hold its own shipping settings that differ from the master's, so a master save
 * does NOT reach it? (81 — 마스터 저장 후 "이 변경이 닿지 않는 채널" 안내용.)
 *
 * A master save reaches a channel by inheritance (`채널 ?? 마스터 ?? 계정`) only for keys the channel
 * does not own. So the channel diverges when it owns a master-level key whose value differs from the
 * master's — including the case where the master leaves that key empty (master = inherit the account,
 * channel = its own value). A channel with no override of its own never diverges.
 *
 * ⚠️ **안내 표시 전용 미리보기** — 등록 차단 판정(`shippingReady`)과 달리 프론트가 계산해도 되는 값이지만,
 * 실제 적용 결과의 정답은 백엔드 응답(`affectedChannels`)이다. 백엔드 규칙이 바뀌면 이 함수도 함께 고칠 것.
 */
export function channelDivergesFromMaster(
  channelOverride: Record<string, string> | null | undefined,
  masterMap: Record<string, string>,
): boolean {
  if (!channelOverride) return false;
  return Object.keys(channelOverride).some(
    (key) => !PLACE_OVERRIDE_KEYS.includes(key) && channelOverride[key] !== masterMap[key],
  );
}

/**
 * Serialize a typed override to the backend key→string map (75 storage contract).
 * Blank strings and nulls are dropped (= inherit); numbers are stringified. The
 * backend whitelist (ShippingOverrideKeys) drops any master-level place keys.
 */
export function overrideToMap(o: ShippingOverride): Record<string, string> {
  const map: Record<string, string> = {};
  (Object.keys(o) as (keyof ShippingOverride)[]).forEach((key) => {
    const value = o[key];
    if (value === null || value === undefined) return;
    if (typeof value === 'string' && value.trim() === '') return;
    map[key] = String(value);
  });
  return map;
}

/** Rebuild a typed override from the backend key→string map (numeric keys parsed). */
export function mapToOverride(map: Record<string, string> | null | undefined): ShippingOverride {
  const result: ShippingOverride = { ...EMPTY_SHIPPING_OVERRIDE };
  if (!map) return result;
  (Object.keys(map) as (keyof ShippingOverride)[]).forEach((key) => {
    if (!(key in result)) return;
    const raw = map[key];
    if (NUMERIC_OVERRIDE_KEYS.includes(key)) {
      const n = Number(raw);
      (result[key] as number | null) = raw === '' || Number.isNaN(n) ? null : n;
    } else {
      (result[key] as string | null) = raw === '' ? null : raw;
    }
  });
  return result;
}

/** A stored shipping config (74 account default or resolved baseline) as a ShippingOverride. */
export function configToOverride(c: ShippingConfig | null | undefined): ShippingOverride {
  if (!c) return { ...EMPTY_SHIPPING_OVERRIDE };
  return {
    outboundShippingPlaceCode: c.outboundShippingPlaceCode,
    returnCenterCode: c.returnCenterCode,
    returnChargeName: c.returnChargeName,
    returnContactNumber: c.returnContactNumber,
    returnZipCode: c.returnZipCode,
    returnAddress: c.returnAddress,
    returnAddressDetail: c.returnAddressDetail,
    returnCharge: c.returnCharge,
    deliveryChargeOnReturn: c.deliveryChargeOnReturn,
    deliveryMethod: c.deliveryMethod,
    deliveryCompanyCode: c.deliveryCompanyCode,
    deliveryChargeType: c.deliveryChargeType,
    deliveryCharge: c.deliveryCharge,
    freeShipOverAmount: c.freeShipOverAmount,
    remoteAreaDeliverable: c.remoteAreaDeliverable,
    unionDeliveryType: c.unionDeliveryType,
    extraInfoMessage: c.extraInfoMessage,
  };
}

const isBlank = (v: string | number | null | undefined) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Pre-fill a channel form (76): show the inherited preset (master ?? account) filled in, with the
 * channel's own override taking precedence per field. `own` non-blank wins; otherwise `base`.
 */
export function mergePreset(own: ShippingOverride, base: ShippingOverride): ShippingOverride {
  const picked: Record<string, unknown> = {};
  (Object.keys(own) as (keyof ShippingOverride)[]).forEach((key) => {
    if (!isBlank(own[key])) picked[key] = own[key];
  });
  return { ...base, ...picked } as ShippingOverride;
}

/**
 * Diff a pre-filled channel form against the inherited baseline (76): only fields the user actually
 * changed to a non-blank value that differs from the baseline are persisted as this channel's override;
 * fields left at the preset (or cleared) are omitted → they keep inheriting master/account.
 */
export function diffOverride(form: ShippingOverride, base: ShippingOverride): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(form) as (keyof ShippingOverride)[]).forEach((key) => {
    const fs = isBlank(form[key]) ? '' : String(form[key]);
    const bs = isBlank(base[key]) ? '' : String(base[key]);
    if (fs !== '' && fs !== bs) out[key] = fs;
  });
  return out;
}
