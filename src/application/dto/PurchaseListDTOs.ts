/**
 * One check-in input — product × seller (PLAN 2609_29 D1 · D3).
 *
 * ⚠️ It belongs to the product, not to an order line: a check-in means "this seller brought in this many", not
 * "this order's share".
 * ⚠️ Send <b>only one</b> of totalAmount and unitPrice (PLAN 2609_28 D2) — both → the server answers 400.
 * Omit the unused key entirely; a null value is serialized as is and also ends in 400.
 * Omitting both saves an "amount unknown" row — it is never replaced with 0.
 * ⚠️ recordStock is always sent as true. The server writes stock only while the stock link setting is on
 * (FEATURE_2610_09 D65) — the screen has no switch for it (D71 ③).
 */
export interface RecordPurchaseRequest {
  productId: number;
  sellerId: number;
  purchasedOn: string;
  quantity: number;
  totalAmount?: number;
  unitPrice?: number;
  reflectToBasePrice: boolean;
  recordStock: boolean;
}

/**
 * Result of one check-in. stockRecorded=false → no stock written: a negative correction (PLAN 2609_29 D17) or the
 * stock link setting is off (FEATURE_2610_09 D65).
 */
export interface PurchaseRecordResult {
  purchaseRecordId: number;
  stockRecorded: boolean;
}

/** Manual line add — the seller is required (FEATURE_2610_09 D11). */
export interface AddManualItemRequest {
  productId: number;
  sellerId: number;
  quantity: number;
}

/** Manual line quantity — 1 or more (FEATURE_2610_09 D23 · D77). */
export interface AdjustManualQtyRequest {
  manualQty: number;
}

/** [매입 완료] · [오늘 매입 안 함] on one share (FEATURE_2610_09 D57 · D61). */
export interface PurchaseCheckRequest {
  productId: number;
  sellerId: number;
  status: 'PURCHASED' | 'NOT_NEEDED' | 'TOMORROW';
}
