/** Request bodies of FEATURE_2610_19 (intake work · cash settlement). */

/** 「입고 작업」 [입고 저장] (D117 ⑥). */
export interface IntakeRequest {
  movedOn: string;
  lines: { productId: number; quantity: number }[];
}

/** 「돈으로 정리」 (D90 · D99 ①). */
export interface SettlementRequest {
  payerSellerId: number;
  receiverSellerId: number;
  settledOn: string;
  amount: number;
  memo?: string;
}
