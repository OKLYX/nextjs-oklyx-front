export type PurchaseLineSource = 'ORDER' | 'MANUAL';

export interface PurchaseRecord {
  id: number;
  purchasedOn: string;
  quantity: number;
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
