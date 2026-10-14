// 11st shipping settings (FEATURE_2610_13 / D84 · D85 · D91 · D104 · D106). One string map with `elevenst.*` keys
// at every level: the 11st channel default (its own table), the master override (shared with the Coupang keys)
// and an 11st listing override. Mirrors the backend `ElevenstShippingKeys` — keep the two in step.

export type ElevenstShippingMap = Record<string, string>;

export const ELEVENST_PREFIX = 'elevenst.';

export const ELEVENST_KEYS = {
  areaCode: 'elevenst.dlvCnAreaCd',
  method: 'elevenst.dlvWyCd',
  courier: 'elevenst.dlvEtprsCd',
  feeType: 'elevenst.dlvCstInstBasiCd',
  fee: 'elevenst.dlvCst1',
  freeOver: 'elevenst.prdFrDlvBasiAmt',
  tierStarts: 'elevenst.dlvCnt1',
  tierEnds: 'elevenst.dlvCnt2',
  tierFees: 'elevenst.dlvCst3',
  perItemFee: 'elevenst.dlvCst4',
  payType: 'elevenst.dlvCstPayTypCd',
  codNotice: 'elevenst.dlvCstInfoCd',
  bundle: 'elevenst.bndlDlvCnYn',
  jejuFee: 'elevenst.jejuDlvCst',
  islandFee: 'elevenst.islandDlvCst',
  returnFee: 'elevenst.rtngdDlvCst',
  exchangeFee: 'elevenst.exchDlvCst',
  returnFeeMethod: 'elevenst.rtngdDlvCd',
  outboundSeq: 'elevenst.addrSeqOut',
  returnSeq: 'elevenst.addrSeqIn',
} as const;

/** Address numbers belong to one 11st account — never on the master (D85). */
export const ELEVENST_PLACE_KEYS: string[] = [ELEVENST_KEYS.outboundSeq, ELEVENST_KEYS.returnSeq];

export interface CodeOption {
  value: string;
  label: string;
}

/** D91 — the codes the screen offers (09 · 10 are not offered). */
export const ELEVENST_AREA_OPTIONS: CodeOption[] = [
  { value: '01', label: '전국' },
  { value: '02', label: '전국(제주·도서산간 제외)' },
];
export const ELEVENST_METHOD_OPTIONS: CodeOption[] = [
  { value: '01', label: '택배' },
  { value: '03', label: '직접전달(화물배달)' },
  { value: '04', label: '퀵서비스' },
  { value: '05', label: '배송 필요 없음' },
];
export const ELEVENST_FEE_TYPE_OPTIONS: CodeOption[] = [
  { value: '01', label: '무료' },
  { value: '02', label: '고정 배송비' },
  { value: '03', label: '조건부 무료' },
  { value: '04', label: '수량별 차등' },
  { value: '05', label: '1개당 배송비' },
  { value: '07', label: '판매자 조건부 배송비(셀러오피스 설정)' },
  { value: '08', label: '출고지 조건부 배송비(셀러오피스 설정)' },
];
export const ELEVENST_PAY_TYPE_OPTIONS: CodeOption[] = [
  { value: '01', label: '선결제/착불 가능' },
  { value: '02', label: '착불' },
  { value: '03', label: '선결제' },
];
export const ELEVENST_BUNDLE_OPTIONS: CodeOption[] = [
  { value: 'Y', label: '가능' },
  { value: 'N', label: '불가' },
];
export const ELEVENST_RETURN_FEE_METHOD_OPTIONS: CodeOption[] = [
  { value: '01', label: '왕복(편도×2)' },
  { value: '02', label: '편도' },
];
export const ELEVENST_COD_NOTICE_OPTIONS: CodeOption[] = [
  { value: '01', label: '상품상세 참고' },
  { value: '02', label: '상품별 차등' },
  { value: '03', label: '지역별 차등' },
  { value: '04', label: '상품/지역별 차등' },
  { value: '06', label: '서울/경기 무료, 이외 추가' },
];

/** D106: at most 10 quantity tiers. */
export const ELEVENST_MAX_TIERS = 10;

export const TIER_LIMIT_MESSAGE = '수량별 배송비는 10구간까지 넣을 수 있습니다.';
export const TIER_CHAIN_MESSAGE =
  '수량별 배송비 구간이 이어지지 않습니다. 첫 구간은 1개부터, 다음 구간은 앞 구간 끝 수량 + 1 부터 시작해야 합니다.';

/** One 「04 수량별 차등」 row as typed — `end` is blank on the last row (D106). */
export interface ElevenstTier {
  start: string;
  end: string;
  fee: string;
}

const splitJoined = (joined: string | undefined): string[] =>
  joined == null || joined.trim() === '' ? [] : joined.split('^');

/** The stored `^`-joined strings → editable rows (the last row has no end). */
export function tiersOf(map: ElevenstShippingMap): ElevenstTier[] {
  const starts = splitJoined(map[ELEVENST_KEYS.tierStarts]);
  const ends = splitJoined(map[ELEVENST_KEYS.tierEnds]);
  const fees = splitJoined(map[ELEVENST_KEYS.tierFees]);
  // A row lives while its start or fee is stored.
  const count = Math.max(starts.length, fees.length);
  return Array.from({ length: count }, (_, i) => ({
    start: starts[i] ?? '',
    end: ends[i] ?? '',
    fee: fees[i] ?? '',
  }));
}

/** Editable rows → the three stored keys; no rows removes the three keys. */
export function withTiers(map: ElevenstShippingMap, tiers: ElevenstTier[]): ElevenstShippingMap {
  const next: ElevenstShippingMap = { ...map };
  delete next[ELEVENST_KEYS.tierStarts];
  delete next[ELEVENST_KEYS.tierEnds];
  delete next[ELEVENST_KEYS.tierFees];
  if (tiers.length === 0) return next;
  next[ELEVENST_KEYS.tierStarts] = tiers.map((t) => t.start.trim()).join('^');
  next[ELEVENST_KEYS.tierEnds] = tiers
    .slice(0, -1)
    .map((t) => t.end.trim())
    .join('^');
  next[ELEVENST_KEYS.tierFees] = tiers.map((t) => t.fee.trim()).join('^');
  return next;
}

/**
 * D106 save check, the same rule and wording as the backend `ElevenstShippingKeys.validateTiers`: null = fine.
 * No tier keys at all = nothing to check.
 */
export function tierError(map: ElevenstShippingMap): string | null {
  const tiers = tiersOf(map);
  if (tiers.length === 0) return null;
  if (tiers.length > ELEVENST_MAX_TIERS) return TIER_LIMIT_MESSAGE;
  const isCount = (v: string) => /^\d+$/.test(v.trim());
  if (!tiers.every((t) => isCount(t.start) && isCount(t.fee))) return TIER_CHAIN_MESSAGE;
  if (Number(tiers[0].start) !== 1) return TIER_CHAIN_MESSAGE;
  for (let i = 0; i < tiers.length - 1; i++) {
    const end = tiers[i].end.trim();
    if (!isCount(end) || Number(end) < Number(tiers[i].start)) return TIER_CHAIN_MESSAGE;
    if (Number(tiers[i + 1].start) !== Number(end) + 1) return TIER_CHAIN_MESSAGE;
  }
  return null;
}

/** Blank values dropped — a blank = 「기본값 사용」 (inherit) on the master / listing level. */
export function cleanElevenstMap(map: ElevenstShippingMap): ElevenstShippingMap {
  const out: ElevenstShippingMap = {};
  Object.entries(map).forEach(([key, value]) => {
    if (key.startsWith(ELEVENST_PREFIX) && value != null && value.trim() !== '') out[key] = value.trim();
  });
  return out;
}

/** The `elevenst.*` part of a stored override map (the master map holds both platforms, D104). */
export function pickElevenst(map: Record<string, string> | null | undefined): ElevenstShippingMap {
  const out: ElevenstShippingMap = {};
  Object.entries(map ?? {}).forEach(([key, value]) => {
    if (key.startsWith(ELEVENST_PREFIX)) out[key] = value;
  });
  return out;
}

/**
 * Pre-fill an 11st listing form (same rule as the Coupang `mergePreset`): the listing's own value wins per key,
 * otherwise the inherited baseline (master ?? channel default).
 */
export function mergeElevenstPreset(own: ElevenstShippingMap, base: ElevenstShippingMap): ElevenstShippingMap {
  return { ...cleanElevenstMap(base), ...cleanElevenstMap(own) };
}

/** Only the keys changed from the baseline become the listing's override (same rule as `diffOverride`). */
export function diffElevenst(form: ElevenstShippingMap, base: ElevenstShippingMap): ElevenstShippingMap {
  const cleanForm = cleanElevenstMap(form);
  const cleanBase = cleanElevenstMap(base);
  const out: ElevenstShippingMap = {};
  Object.entries(cleanForm).forEach(([key, value]) => {
    if (cleanBase[key] !== value) out[key] = value;
  });
  return out;
}

/** Stored 11st channel default (`GET` / `PUT …/elevenst-shipping-config`). Nothing stored = empty map. */
export interface ElevenstShippingConfig {
  marketplaceAccountId: number;
  settings: ElevenstShippingMap;
  /** D120: 11st listings of this channel whose re-price failed after a save (0 on a read). */
  priceRecalcFailedCount?: number;
}

/**
 * D120 — the note a shipping save adds when some 11st listings could not be re-priced
 * (`priceRecalcFailedCount` > 0). '' when there is none.
 */
export const recalcFailureNote = (failed: number | undefined): string =>
  failed && failed > 0
    ? `가격을 다시 계산하지 못한 상품 ${failed}개 — [가격 점검]에서 확인하세요`
    : '';

/** D120 — `text`, then one space and {@link recalcFailureNote} when there is a note. */
export const withRecalcNote = (text: string, failed: number | undefined): string => {
  const note = recalcFailureNote(failed);
  return note ? `${text} ${note}` : text;
};
