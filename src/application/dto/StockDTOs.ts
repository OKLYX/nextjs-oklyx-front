import type { StockMovementType, StockReason } from '@/domain/entities/StockEntity';

/**
 * 사람이 확인한 실물 이동 1건 (FEATURE_2609_28 / PLAN D5~D10).
 *
 * ⚠️ quantity 는 <b>항상 양수</b>로 보낸다 — 폐기의 부호는 서버가 뒤집는다(04 Step 4).
 * 조정(ADJUST)만 예외로 음수를 허용한다. 화면에서 −3 을 만들어 보내면 웹·모바일이 갈린다.
 * ⚠️ sellerId 는 RETURN_IN 을 뺀 전 유형에서 필수다. RETURN_IN 은 서버가 클레임 → 주문으로
 * 유도하되, 주문 미매칭 클레임이면 400 이 나므로 그때만 화면이 판매자를 실어 보낸다.
 * ⚠️ 안 쓰는 키는 생략한다 — null 을 넣으면 그대로 직렬화되어 서버 검증에 걸린다.
 */
export interface RecordMovementRequest {
  productId: number;
  sellerId?: number;
  movementType: StockMovementType;
  quantity: number;
  reason?: StockReason;
  reasonNote?: string;
  /** OPENING(기초재고)에서만 필수. PURCHASE 는 구매기록 단가를 승계하므로 보내지 않는다(D8). */
  unitPrice?: number;
  /** RETURN_IN 필수. */
  orderClaimId?: number;
  /** STOCK_IN + PURCHASE 필수. */
  purchaseRecordId?: number;
  movedOn: string;
}

/**
 * 출고 확인 1건 (PLAN D11·D12).
 *
 * ⚠️ 상품 줄마다 요청을 따로 보낸다 — lines 는 한 건짜리다. 모아서 보내면 중단 시
 * 어디까지 처리했는지 잃는다(D12).
 */
export interface ConfirmOutboundRequest {
  orderLineId: number;
  lines: { productId: number; quantity: number }[];
  movedOn: string;
}

/** 잔량 조회 필터. sellerId 생략 = 전 판매자(행은 여전히 판매자별로 나온다). */
export interface StockBalanceParams {
  productId?: number;
  sellerId?: number;
  keyword?: string;
}

/** 이력 조회 필터. from/to 생략 = 최근 30일(서버 기본값). */
export interface StockHistoryParams {
  productId?: number;
  sellerId?: number;
  from?: string;
  to?: string;
}
