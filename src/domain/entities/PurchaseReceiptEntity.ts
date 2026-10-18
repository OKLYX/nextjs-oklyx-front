/**
 * One row of the receipt list (FEATURE_2610_18 D94).
 *
 * cardAlias null = the card was unknown (shown as 「카드 없음」). totalAmount = sum of the lines with an amount; null when
 * every line was left blank (shown as 「미기입」). productCount = number of lines.
 */
export interface ReceiptSummary {
  id: number;
  purchasedOn: string;
  payerSellerId: number;
  payerSellerName: string;
  cardAlias: string | null;
  firstProductName: string | null;
  productCount: number;
  totalAmount: number | null;
}

/** One line of a receipt. totalAmount/unitPrice null = amount not entered (D41 · D68). */
export interface ReceiptLine {
  productName: string;
  quantity: number;
  totalAmount: number | null;
  unitPrice: number | null;
  reflectToBasePrice: boolean;
}

/**
 * One receipt with its photo (stored value — render through resolveThumbUrl) and every line (D93 · D94).
 * payerSellerId · cardId · cardMaskedNumber start the header edit (D100); cardId null = the card was unknown, and a
 * hidden card keeps its alias and number here (D91 · D100 ⑥).
 */
export interface ReceiptDetail {
  id: number;
  purchasedOn: string;
  payerSellerId: number;
  payerSellerName: string;
  cardId: number | null;
  cardAlias: string | null;
  cardMaskedNumber: string | null;
  photoUrl: string;
  lines: ReceiptLine[];
}
