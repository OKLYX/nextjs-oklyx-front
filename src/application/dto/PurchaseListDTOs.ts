export interface RecordPurchaseRequest {
  purchasedOn: string;
  quantity: number;
}

export interface AddManualItemRequest {
  productId: number;
  quantity: number;
}

export interface AdjustManualQtyRequest {
  manualQty: number;
}
