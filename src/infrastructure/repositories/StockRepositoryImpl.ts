import { axiosInstance } from '@/infrastructure/api/axiosInstance';
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

/**
 * `/api/admin/stock/**` 호출부 (FEATURE_2609_28).
 *
 * ⚠️ 서버 400 메시지를 여기서 잡지 않는다 — 화면이 원문을 그대로 띄운다(사유·수량 규칙의 주인은 서버다).
 */
export class StockRepositoryImpl implements StockRepository {
  async recordMovement(request: RecordMovementRequest): Promise<StockMovement> {
    const response = await axiosInstance.post('/api/admin/stock/movements', request);
    return response.data.data;
  }

  async getBalances(params: StockBalanceParams): Promise<StockBalance[]> {
    const response = await axiosInstance.get('/api/admin/stock/balances', { params });
    return response.data.data;
  }

  async getHistory(params: StockHistoryParams): Promise<StockMovement[]> {
    const response = await axiosInstance.get('/api/admin/stock/movements', { params });
    return response.data.data;
  }

  async getPurchaseCandidates(productId?: number): Promise<PurchaseCandidate[]> {
    const response = await axiosInstance.get('/api/admin/stock/purchase-candidates', {
      params: productId ? { productId } : {},
    });
    return response.data.data;
  }

  async getReturnCandidates(): Promise<ReturnCandidate[]> {
    const response = await axiosInstance.get('/api/admin/stock/return-candidates');
    return response.data.data;
  }

  async getOutbound(sellerId?: number, status?: string): Promise<OutboundList> {
    const params: Record<string, string | number> = {};
    if (sellerId) params.sellerId = sellerId;
    if (status) params.status = status;
    const response = await axiosInstance.get('/api/admin/stock/outbound', { params });
    return response.data.data;
  }

  async confirmOutbound(request: ConfirmOutboundRequest): Promise<StockMovement[]> {
    const response = await axiosInstance.post('/api/admin/stock/outbound/confirm', request);
    return response.data.data;
  }
}
