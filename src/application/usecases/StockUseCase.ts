import type { StockRepository } from '@/domain/repositories/StockRepository';
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

/** 실물 재고 원장 유스케이스 (FEATURE_2609_28). 세 화면(입고·조정 / 출고 확인 / 재고 조회)이 공유한다. */
export class StockUseCase {
  constructor(private repository: StockRepository) {}

  async recordMovement(request: RecordMovementRequest): Promise<StockMovement> {
    return this.repository.recordMovement(request);
  }

  async getBalances(params: StockBalanceParams): Promise<StockBalance[]> {
    return this.repository.getBalances(params);
  }

  async getHistory(params: StockHistoryParams): Promise<StockMovement[]> {
    return this.repository.getHistory(params);
  }

  async getPurchaseCandidates(productId?: number): Promise<PurchaseCandidate[]> {
    return this.repository.getPurchaseCandidates(productId);
  }

  async getReturnCandidates(): Promise<ReturnCandidate[]> {
    return this.repository.getReturnCandidates();
  }

  async getOutbound(sellerId?: number, status?: string): Promise<OutboundList> {
    return this.repository.getOutbound(sellerId, status);
  }

  async confirmOutbound(request: ConfirmOutboundRequest): Promise<StockMovement[]> {
    return this.repository.confirmOutbound(request);
  }
}
