export type PurchaseLineSource = 'ORDER' | 'MANUAL';

/**
 * One recent purchase row (PLAN 2609_29 D9 · FEATURE_2610_09 D7 · D25).
 *
 * ⚠️ Without a seller filter the rows of every seller come mixed — sellerName is drawn on each row.
 * Amounts are null on rows recorded before FEATURE_2609_28 — "amount unknown", not 0.
 */
export interface PurchaseRecord {
  id: number;
  purchasedOn: string;
  quantity: number;
  totalAmount: number | null;
  unitPrice: number | null;
  reflectToBasePrice: boolean;
  sellerName: string;
}

/**
 * One contributing line shown in an opened product row (PLAN 2609_29 D7 · D8 · FEATURE_2610_09 D17).
 *
 * ⚠️ A line has no purchased quantity and no purchase history — purchase records do not know order lines (D3).
 * sellerId · sellerName are filled on both kinds. A manual line keeps orderLineId · externalOrderId ·
 * marketplaceAccountId · platform null and is drawn as 「{sellerName}/수동」.
 */
export interface PurchaseListLine {
  itemId: number;
  orderLineId: number | null;
  source: PurchaseLineSource;
  externalOrderId: string | null;
  marketplaceAccountId: number | null;
  sellerId: number;
  sellerName: string;
  platform: string | null;
  autoQty: number;
  manualQty: number;
  neededQty: number;
}

/**
 * Processing state of one (product × seller) share (FEATURE_2610_09 D57 · D67 · D79 · D80).
 * OPEN = to buy · SKIPPED_TODAY = 「내일 매입」 today · PURCHASED = 「매입 완료」 · NOT_NEEDED = 「필요 없음」 · NEED_ZERO = 「필요 0」.
 */
export type PurchaseShareState = 'OPEN' | 'SKIPPED_TODAY' | 'PURCHASED' | 'NOT_NEEDED' | 'NEED_ZERO';

/** One seller's share of a product (FEATURE_2610_09 D2 · D59). */
export interface PurchaseShare {
  sellerId: number;
  sellerName: string;
  neededQty: number;
  purchasedQty: number;
  remainingQty: number;
  /** purchasedQty ≥ neededQty — the 「목표 수량 매입 완료」 tag (D57 ①). */
  targetMet: boolean;
  state: PurchaseShareState;
  /** Undo target of SKIPPED_TODAY · PURCHASED · NOT_NEEDED; null otherwise. */
  checkId: number | null;
  /** Processing day (yyyy-MM-dd) of PURCHASED · NOT_NEEDED · NEED_ZERO; null otherwise. */
  checkedOn: string | null;
}

export interface PurchaseListItem {
  productId: number;
  productName: string;
  /** Product brand; null when the product has none (absent on older servers). */
  brand?: string | null;
  neededQty: number;
  purchasedQty: number;
  remainingQty: number;
  /** Seller chosen: that one share. 「전체」: every shown share, seller id ascending. */
  shares: PurchaseShare[];
  lines: PurchaseListLine[];
}

export interface UnmappedOrder {
  externalItemId: string;
  itemName: string;
  purchasableQty: number;
  orderCount: number;
}

export interface PurchaseList {
  items: PurchaseListItem[];
  /** The 「오늘 넘김」 group — rows put off with 「내일 매입」 today (FEATURE_2610_09 D67). */
  skippedToday: PurchaseListItem[];
  unmappedOrders: UnmappedOrder[];
}
