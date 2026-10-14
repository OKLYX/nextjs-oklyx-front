// 11st product notification preview (FEATURE_2610_13 / D97 · D99 · D100 · D101). The server converts the master's
// notice values (Coupang item names) with the same code the 11st upload uses (`POST /api/admin/elevenst/notice-preview`).

/** D101: an 11st-only notice value lives in the master notice map under this prefix + the 11st item code. */
export const ELEVENST_NOTICE_PREFIX = 'ELEVENST:';

/** One 11st notice item. `ownKey` is set only for an 11st-only item — the map key its value is stored under. */
export interface ElevenstNoticeLine {
  code: string;
  name: string;
  value: string;
  ownKey: string | null;
}

export interface ElevenstNotification {
  typeCode: string;
  typeName: string;
  lines: ElevenstNoticeLine[];
  /** The request's Coupang item keys that some 11st item reads (= the items both platforms share). */
  usedCoupangItems: string[];
}

export interface ElevenstNoticePreviewRequest {
  group: string;
  notices: Record<string, string>;
}

/** The non-blank `ELEVENST:*` values of a notice map — saved next to the chosen group's Coupang values. */
export function elevenstOwnNotices(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(ELEVENST_NOTICE_PREFIX) && value.trim() !== '') out[key] = value;
  });
  return out;
}
