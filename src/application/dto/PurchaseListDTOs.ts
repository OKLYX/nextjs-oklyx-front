/**
 * 라인 구매 기록 입력.
 *
 * ⚠️ totalAmount 와 unitPrice 는 <b>둘 중 하나만</b> 보낸다(PLAN 2609_28 D2) — 둘 다 오면 서버가 400.
 * 안 쓰는 쪽은 키 자체를 생략한다. null 을 넣으면 그대로 직렬화되어 400 이 난다.
 * 둘 다 생략하면 "금액 미상" 행으로 저장된다 — 0 으로 치환하지 않는다.
 */
export interface RecordPurchaseRequest {
  purchasedOn: string;
  quantity: number;
  totalAmount?: number;
  unitPrice?: number;
  reflectToBasePrice: boolean;
}

export interface AddManualItemRequest {
  productId: number;
  quantity: number;
}

export interface AdjustManualQtyRequest {
  manualQty: number;
}
