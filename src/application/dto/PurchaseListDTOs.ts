/**
 * 입고 1회 입력 — 물품 × 판매자 (PLAN 2609_29 D1·D3).
 *
 * ⚠️ 주문 라인이 아니라 물품에 붙는다: 입고는 "이 주문 몫"이 아니라 "이 판매자가 이만큼 들였다"이다.
 * ⚠️ totalAmount 와 unitPrice 는 <b>둘 중 하나만</b> 보낸다(PLAN 2609_28 D2) — 둘 다 오면 서버가 400.
 * 안 쓰는 쪽은 키 자체를 생략한다. null 을 넣으면 그대로 직렬화되어 400 이 난다.
 * 둘 다 생략하면 "금액 미상" 행으로 저장된다 — 0 으로 치환하지 않는다.
 * ⚠️ recordStock 은 항상 true 로 보낸다 — 화면 체크박스는 체크 + 비활성이다(PLAN 2609_29 D19).
 */
export interface RecordPurchaseRequest {
  productId: number;
  sellerId: number;
  purchasedOn: string;
  quantity: number;
  totalAmount?: number;
  unitPrice?: number;
  reflectToBasePrice: boolean;
  recordStock: boolean;
}

/** 입고 1회의 결과. stockRecorded=false → 음수 정정이라 재고가 반영되지 않았다(PLAN 2609_29 D17). */
export interface PurchaseRecordResult {
  purchaseRecordId: number;
  stockRecorded: boolean;
}

export interface AddManualItemRequest {
  productId: number;
  quantity: number;
}

export interface AdjustManualQtyRequest {
  manualQty: number;
}
