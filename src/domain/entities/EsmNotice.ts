// Gmarket · Auction (ESM) official notice preview (FEATURE_2610_26 / D17 · D46 · D56). The server converts the master's
// notice values (Coupang item names) with the same code the ESM upload uses (`POST /api/admin/esm/notice-preview`).

/** D17: an ESM-only notice value lives in the master notice map under this prefix + the ESM item code. */
export const ESM_NOTICE_PREFIX = 'ESM:';

/** One ESM notice item. `ownKey` is set only for an ESM-only item — the map key its value is stored under. */
export interface EsmNoticeLine {
  code: string;
  name: string;
  value: string;
  extraMark: boolean;
  ownKey: string | null;
}

export interface EsmNotification {
  groupNo: string;
  groupName: string;
  lines: EsmNoticeLine[];
  /** The request's Coupang item keys that some ESM item reads (= the items both platforms share). */
  usedCoupangItems: string[];
}

export interface EsmNoticePreviewRequest {
  group: string;
  notices: Record<string, string>;
}

/** The non-blank `ESM:*` values of a notice map — saved next to the chosen group's Coupang values. */
export function esmOwnNotices(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(ESM_NOTICE_PREFIX) && value.trim() !== '') out[key] = value;
  });
  return out;
}
