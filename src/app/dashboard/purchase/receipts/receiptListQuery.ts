import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { ReceiptListParams } from '@/application/dto/PurchaseReceiptDTOs';

/**
 * Receipt list conditions (from/to/sellerId/q) — URL query string ↔ query object ↔ API params, one source
 * (FEATURE_2610_18 D94 · the list-query standard of the master list `master-products/masterListQuery.ts`).
 *
 * **File**: src/app/dashboard/purchase/receipts/receiptListQuery.ts
 *
 * - Default period = the latest 30 days: today and the 29 days before it (D94 「처음 최근 30일」).
 * - Default keys are not written to the URL (clean URL); a bad value falls back to the default.
 *
 * ⚠️ The URL key is `q`, the API parameter is `productName`. Convert only in `toApiParams`.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** 30 days including today (D94). */
const DEFAULT_PERIOD_DAYS = 30;

export interface ReceiptListQuery {
  from: string;
  to: string;
  sellerId?: number;
  q?: string;
}

// Local calendar day (YYYY-MM-DD) — toISOString (UTC) can be a day off in KST.
const dateStr = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** Today and the 29 days before it. */
export function defaultPeriod(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DEFAULT_PERIOD_DAYS - 1));
  return { from: dateStr(start), to: dateStr(today) };
}

/** Bad or missing from/to → default period · sellerId not a positive integer → none · q trimmed, empty → none. */
export function parseQuery(sp: URLSearchParams | ReadonlyURLSearchParams): ReceiptListQuery {
  const period = defaultPeriod();
  const rawFrom = sp.get('from') ?? '';
  const rawTo = sp.get('to') ?? '';
  const rawSeller = Number(sp.get('sellerId'));
  const q = (sp.get('q') ?? '').trim();
  return {
    from: DATE_PATTERN.test(rawFrom) ? rawFrom : period.from,
    to: DATE_PATTERN.test(rawTo) ? rawTo : period.to,
    ...(Number.isInteger(rawSeller) && rawSeller > 0 ? { sellerId: rawSeller } : {}),
    ...(q ? { q } : {}),
  };
}

/** Default and empty keys are left out. */
export function toSearchParams(query: ReceiptListQuery): URLSearchParams {
  const period = defaultPeriod();
  const params = new URLSearchParams();
  if (query.from !== period.from) params.set('from', query.from);
  if (query.to !== period.to) params.set('to', query.to);
  if (query.sellerId) params.set('sellerId', String(query.sellerId));
  const q = query.q?.trim();
  if (q) params.set('q', q);
  return params;
}

/** URL vocabulary (q) → API vocabulary (productName). This conversion lives here only. */
export function toApiParams(query: ReceiptListQuery): ReceiptListParams {
  const productName = query.q?.trim();
  return {
    from: query.from,
    to: query.to,
    ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    ...(productName ? { productName } : {}),
  };
}
