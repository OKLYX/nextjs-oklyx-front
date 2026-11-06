// LotteON product notice preview (FEATURE_2610_24 / D38 · D56 · D63). The server converts the master's notice values
// (Coupang item names, plus the `LOTTEON:*` keys) with the same code the LotteON upload uses
// (`POST /api/admin/lotteon/notice-preview`).

/** D63 ①: a LotteON-only notice value lives in the master notice map under this prefix. */
export const LOTTEON_NOTICE_PREFIX = 'LOTTEON:';

/** One LotteON notice item. `ownKey` is set only for a LotteON-only item — the map key its value is stored under. */
export interface LotteonNoticeLine {
  code: string;
  name: string;
  value: string;
  ownKey: string | null;
}

export interface LotteonNotification {
  itemGroupCode: string;
  itemGroupName: string;
  lines: LotteonNoticeLine[];
  /** The request's Coupang item keys that some LotteON item reads (= the items both platforms share). */
  usedCoupangItems: string[];
}

export interface LotteonNoticePreviewRequest {
  group: string;
  notices: Record<string, string>;
}

/** D68: the non-blank `LOTTEON:*` values of a notice map — saved next to the chosen group's Coupang values. */
export function lotteonOwnNotices(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(LOTTEON_NOTICE_PREFIX) && value.trim() !== '') out[key] = value;
  });
  return out;
}
