import type { ReceiptLineRequest } from './PurchaseReceiptDTOs';

/** Request bodies of FEATURE_2610_19 (intake work · cash settlement) and FEATURE_2611_01 (seller without a receipt). */

/** 「입고 작업」 reasons (FEATURE_2611_01 D1): 「매입」 · 「기초재고」. */
export type IntakeReason = 'PURCHASE' | 'OPENING';

/**
 * 「입고 작업」 [입고 저장] (D117 ⑥ · FEATURE_2611_01 D1 · D16): sellerId omitted = 「미정」. An 「기초재고」 line without a
 * seller is refused (D19).
 */
export interface IntakeRequest {
  movedOn: string;
  lines: { productId: number; quantity: number; sellerId?: number; reason: IntakeReason }[];
}

/**
 * 「영수증 없이 판매자 정하기」 (FEATURE_2611_01 D2 · D4): RECEIPT_LATER = a receipt without a photo (added later from the
 * receipt edit) · NO_RECEIPT = 「영수증 없음(발견 재고 등)」. The purchase day is the screen day (D8).
 */
export interface ReceiptlessAssignRequest {
  mode: 'RECEIPT_LATER' | 'NO_RECEIPT';
  sellerId: number;
  lines: ReceiptLineRequest[];
}

/** 「판매자 바꾸기」 (FEATURE_2611_01 D7 · D15): incoming row ids and 「영수증 없음」 share record ids. */
export interface SellerChangeRequest {
  sellerId: number;
  movementIds: number[];
  shareRecordIds: number[];
}

/** 「돈으로 정리」 (D90 · D99 ①). */
export interface SettlementRequest {
  payerSellerId: number;
  receiverSellerId: number;
  settledOn: string;
  amount: number;
  memo?: string;
}
