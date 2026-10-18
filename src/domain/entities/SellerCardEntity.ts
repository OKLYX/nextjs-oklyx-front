/**
 * One payment card registered under a seller (FEATURE_2610_18 D29 · D52 · D91).
 * maskedNumber = the masked number as printed on receipts — a full card number is rejected by the server (D92).
 */
export interface SellerCard {
  id: number;
  sellerId: number;
  sellerName: string;
  alias: string;
  maskedNumber: string;
}
