/**
 * 실물 재고 원장 (FEATURE_2609_28 / PLAN D5~D14 · 2609_29 D4·D5).
 *
 * ⚠️ 잔량은 원장 합계로 유도되고, 합계 단위는 <b>(물품 × 판매자)</b>다(D14 개정).
 * 재고는 판매자끼리 공용이 아니므로 같은 물품이라도 판매자가 다르면 다른 행이다.
 *
 * ⚠️ 라벨 매핑은 이 파일 하나에만 둔다 — 화면마다 복제하면 세 화면의 표기가 갈린다.
 */

/** 이동 유형 (PLAN D6). STOCK_OUT 은 출고 확인 화면만 만든다 — 입고 폼에서 선택할 수 없다. */
export type StockMovementType = 'STOCK_IN' | 'STOCK_OUT' | 'RETURN_IN' | 'DISPOSAL' | 'ADJUST';

/** 사유 코드 (PLAN D7). 자유 텍스트가 아니라 코드여야 "폐기 원인 Top N" 이 집계된다. */
export type StockReason =
  | 'PURCHASE'
  | 'OPENING'
  | 'FREE'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'LOST'
  | 'SAMPLE'
  | 'INTERNAL_USE'
  | 'COUNT_DIFF'
  | 'ETC';

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  STOCK_IN: '입고',
  STOCK_OUT: '출고',
  RETURN_IN: '반품입고',
  DISPOSAL: '폐기',
  ADJUST: '조정',
};

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  PURCHASE: '매입',
  OPENING: '기초재고',
  FREE: '무상·보상',
  DAMAGED: '파손',
  EXPIRED: '유통기한 초과',
  LOST: '분실',
  SAMPLE: '증정·샘플',
  INTERNAL_USE: '자가소비',
  COUNT_DIFF: '실사 차이',
  ETC: '기타',
};

/** 입고 폼에서 고를 수 있는 유형 — 출고는 주문에서 출발하므로(D11) 여기 없다. */
export type RecordableMovementType = Exclude<StockMovementType, 'STOCK_OUT'>;

export const RECORDABLE_MOVEMENT_TYPES: RecordableMovementType[] = [
  'STOCK_IN',
  'RETURN_IN',
  'DISPOSAL',
  'ADJUST',
];

/**
 * 유형별 사유 목록 (PLAN D7). 서버 {@code StockReason.allowedFor} 와 같은 표다.
 * RETURN_IN 은 사유를 받지 않는다 — 빈 배열이면 사유 select 를 비활성한다.
 */
export const REASONS_BY_TYPE: Record<StockMovementType, StockReason[]> = {
  STOCK_IN: ['PURCHASE', 'OPENING', 'FREE', 'ETC'],
  RETURN_IN: [],
  DISPOSAL: ['DAMAGED', 'EXPIRED', 'LOST', 'SAMPLE', 'INTERNAL_USE', 'ETC'],
  ADJUST: ['COUNT_DIFF', 'ETC'],
  STOCK_OUT: [],
};

/** 전개 실패 사유 (백엔드 OutboundUnexpandedView.reason). 원문 코드도 그대로 함께 보여준다. */
export const UNEXPANDED_REASON_LABELS: Record<string, string> = {
  UNMAPPED_OPTION: '판매 옵션 미연결',
  NO_MASTER_OPTION: '마스터 옵션 미연결',
  EMPTY_BOM: '구성 물품 없음',
};

export function unexpandedReasonLabel(reason: string): string {
  return UNEXPANDED_REASON_LABELS[reason] ?? reason;
}

/** 원장 한 줄. quantity 는 저장된 부호 그대로다 — 화면에서 부호를 다시 만들지 않는다(D6). */
export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  sellerId: number;
  sellerName: string;
  movementType: StockMovementType;
  quantity: number;
  reason: StockReason | null;
  reasonNote: string | null;
  unitPrice: number | null;
  orderLineId: number | null;
  orderClaimId: number | null;
  purchaseRecordId: number | null;
  movedOn: string;
  createdBy: string | null;
}

/**
 * (물품 × 판매자) 잔량 — 서버 집계 결과다.
 * ⚠️ onHand 는 음수일 수 있다. 숨기거나 0 으로 그리지 않는다(PLAN 04 Step 6) — 음수는 신호다.
 */
export interface StockBalance {
  productId: number;
  productName: string;
  sellerId: number;
  sellerName: string;
  onHand: number;
}

/** 출고 대상 주문 라인이 소진하는 물품 1건. remainingQty = requiredQty − confirmedQty. */
export interface OutboundProductLine {
  productId: number;
  productName: string;
  requiredQty: number;
  confirmedQty: number;
}

/** 출고 확인 화면의 주문 라인 1건 (D11). 오래된 주문이 위에 온다. */
export interface OutboundOrder {
  orderLineId: number;
  externalOrderId: string;
  itemName: string | null;
  status: string;
  orderedAt: string;
  sellerId: number;
  sellerName: string;
  orderQty: number;
  products: OutboundProductLine[];
}

/** 전개하지 못한 주문 라인 (D13). 목록에서 감추면 재고가 조용히 틀린다. */
export interface OutboundUnexpanded {
  orderLineId: number;
  externalOrderId: string;
  itemName: string | null;
  reason: string;
}

export interface OutboundList {
  orders: OutboundOrder[];
  unexpanded: OutboundUnexpanded[];
}

/**
 * 아직 (전량) 입고되지 않은 구매기록 (2609_29 가 만든 GET /purchase-candidates 의 주인이 이 화면이다).
 *
 * ⚠️ sellerId 가 없다 — 응답이 sellerName 만 준다. 입고 폼은 이름으로 판매자를 맞춘다.
 * ⚠️ unitPrice 가 null 이면 "금액 미상"이며 0 이 아니다.
 */
export interface PurchaseCandidate {
  purchaseRecordId: number;
  productId: number;
  productName: string;
  sellerName: string;
  purchasedOn: string;
  purchasedQty: number;
  receivedQty: number;
  remainingQty: number;
  unitPrice: number | null;
}

/**
 * 아직 (전량) 반품입고되지 않은 클레임.
 * ⚠️ 물품이 없다 — 어떤 물품이 돌아왔는지는 사람이 고른다(클레임은 판매 옵션 단위다).
 */
export interface ReturnCandidate {
  orderClaimId: number;
  orderLineId: number | null;
  itemName: string | null;
  externalOrderId: string | null;
  claimQty: number;
  receivedQty: number;
  remainingQty: number;
  claimStatus: string | null;
  collectStatus: string | null;
  receivedAt: string | null;
}
