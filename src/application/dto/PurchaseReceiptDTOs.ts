/**
 * One product line of a receipt check-in (FEATURE_2610_18 D76 · D96 · D97). No seller — every line belongs to the
 * payer seller (D89). Send only one of totalAmount and unitPrice and omit the unused key; omitting both = amount not
 * entered (D41).
 */
export interface ReceiptLineRequest {
  productId: number;
  quantity: number;
  totalAmount?: number;
  unitPrice?: number;
  reflectToBasePrice: boolean;
}

/**
 * The JSON part of a receipt check-in (D87): cardId set → the card owner pays (payerSellerId omitted);
 * cardId omitted (「카드로 알 수 없음」 or one seller) → payerSellerId is required.
 */
export interface CreateReceiptRequest {
  purchasedOn: string;
  cardId?: number;
  payerSellerId?: number;
  lines: ReceiptLineRequest[];
}

/**
 * Receipt header edit (D100) — same card rule as CreateReceiptRequest: cardId set → the card owner pays (payerSellerId
 * omitted); cardId omitted (「카드로 알 수 없음」) → payerSellerId is required. The photo and lines never change.
 */
export interface UpdateReceiptRequest {
  purchasedOn: string;
  cardId?: number;
  payerSellerId?: number;
}

/** Receipt list filter (D94). from/to = yyyy-MM-dd, inclusive. sellerId = payer seller. */
export interface ReceiptListParams {
  from: string;
  to: string;
  sellerId?: number;
  productName?: string;
}
