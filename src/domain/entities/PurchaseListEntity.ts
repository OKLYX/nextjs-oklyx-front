export type PurchaseLineSource = 'ORDER' | 'MANUAL';

export interface PurchaseRecord {
  id: number;
  purchasedOn: string;
  quantity: number;
  // 금액은 FEATURE_2609_28 이전에 기록된 행에서 null 이다 — "금액 미상"이며 0 이 아니다.
  totalAmount: number | null;
  unitPrice: number | null;
  reflectToBasePrice: boolean;
}

export interface PurchaseListLine {
  itemId: number;
  orderItemId: number | null;
  source: PurchaseLineSource;
  externalOrderId: string | null;
  autoQty: number;
  manualQty: number;
  purchasedQty: number;
  records: PurchaseRecord[];
}

export interface PurchaseListItem {
  productId: number;
  productName: string;
  neededQty: number;
  purchasedQty: number;
  remainingQty: number;
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
  unmappedOrders: UnmappedOrder[];
}
