import type {
  OutboundList,
  PurchaseCandidate,
  ReturnCandidate,
  StockBalance,
  StockMovement,
} from '@/domain/entities/StockEntity';
import type {
  ConfirmOutboundRequest,
  RecordMovementRequest,
  StockBalanceParams,
  StockHistoryParams,
} from '@/application/dto/StockDTOs';

/**
 * 실물 재고 원장 API (FEATURE_2609_28). 전 경로가 `/api/admin/stock/**` — ADMIN 전용(D19).
 *
 * ❌ 옛 StockLog API 는 폐기됐다(D21). 재고는 이 인터페이스로만 다룬다.
 */
export interface StockRepository {
  /** 입고·반품입고·폐기·조정. 출고는 서버가 거부한다 — 출고는 confirmOutbound 로만 기록된다. */
  recordMovement(request: RecordMovementRequest): Promise<StockMovement>;
  /** (물품 × 판매자) 잔량. 서버 집계 결과를 그대로 쓴다 — 화면에서 다시 더하지 않는다(D14). */
  getBalances(params: StockBalanceParams): Promise<StockBalance[]>;
  getHistory(params: StockHistoryParams): Promise<StockMovement[]>;
  /** 입고 대기(구매기록) 목록 — STOCK_IN + PURCHASE 의 선택지다. */
  getPurchaseCandidates(productId?: number): Promise<PurchaseCandidate[]>;
  /** 반품입고 대기(클레임) 목록 — RETURN_IN 의 선택지다. */
  getReturnCandidates(): Promise<ReturnCandidate[]>;
  /** 출고 대상 주문 라인 + 전개 실패 목록. */
  getOutbound(sellerId?: number, status?: string): Promise<OutboundList>;
  /** 확인 1건 = 요청 1번(D12). */
  confirmOutbound(request: ConfirmOutboundRequest): Promise<StockMovement[]>;
}
