// The two 11st notice texts kept as master / listing field values (FEATURE_2610_13 / D73 · D74 · D78) and as the
// 11st sales channel default (FEATURE_2610_16 / D4 · D6). Same keys as the backend `ListingTextValueResolver` — keep
// the two in step.

export const AS_NOTICE_KEY = 'asNotice';
export const RETURN_EXCHANGE_NOTICE_KEY = 'returnExchangeNotice';

/**
 * D74: the two fields the master screens always show, in this order. FEATURE_2610_16 / D4: the 11st sales channel
 * modals show the same two fields with the same labels.
 */
export const NOTICE_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: AS_NOTICE_KEY, label: 'A/S 안내' },
  { key: RETURN_EXCHANGE_NOTICE_KEY, label: '반품/교환 안내' },
];

export const NOTICE_TEXT_KEYS: string[] = NOTICE_TEXT_FIELDS.map((f) => f.key);

/** D78: 11st takes at most 4000 EUC-KR bytes per notice text. */
export const NOTICE_TEXT_MAX_BYTES = 4000;
export const NOTICE_TEXT_TOO_LONG_MESSAGE = '11번가는 약 2,000자까지입니다';

/** EUC-KR length: ASCII 1 byte, everything else 2 bytes (Hangul is 2 bytes in EUC-KR). */
export function eucKrByteLength(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += ch.charCodeAt(0) < 0x80 ? 1 : 2;
  return bytes;
}

/** D78: true when either notice text of `values` is over the 11st limit. */
export function noticeTextTooLong(values: Record<string, string>): boolean {
  return NOTICE_TEXT_KEYS.some((key) => eucKrByteLength(values[key] ?? '') > NOTICE_TEXT_MAX_BYTES);
}
