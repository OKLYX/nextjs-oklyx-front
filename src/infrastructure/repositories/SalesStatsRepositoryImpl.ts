import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { SalesStatsRepository } from '@/domain/repositories/SalesStatsRepository';
import type {
  ChannelSales,
  ProductProfit,
  SalesLine,
  SellerSales,
} from '@/domain/entities/SalesSummary';
import type {
  ProductProfitParams,
  SalesLinesParams,
  SalesStatsParams,
} from '@/application/dto/SalesDTOs';

/**
 * `/api/admin/sales/**` 호출부 (FEATURE_2609_30 / 백엔드 03).
 *
 * ⚠️ 빈 값 키는 아예 보내지 않는다 — `from=` 을 보내면 서버 기본값이 아니라 400 이 된다.
 */
export class SalesStatsRepositoryImpl implements SalesStatsRepository {
  private toQuery(params: ProductProfitParams): Record<string, string | number | boolean> {
    const query: Record<string, string | number | boolean> = {};
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.sellerId != null) query.sellerId = params.sellerId;
    if (params.crossChannel != null) query.crossChannel = params.crossChannel;
    return query;
  }

  async getSellerSummary(params: SalesStatsParams): Promise<SellerSales[]> {
    const response = await axiosInstance.get('/api/admin/sales/summary', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }

  async getChannelSales(params: SalesStatsParams): Promise<ChannelSales[]> {
    const response = await axiosInstance.get('/api/admin/sales/by-channel', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }

  async getSalesLines(params: SalesLinesParams): Promise<SalesLine[]> {
    const query: Record<string, string | number> = { accountId: params.accountId };
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    const response = await axiosInstance.get('/api/admin/sales/lines', { params: query });
    return response.data.data;
  }

  async getProductProfit(params: ProductProfitParams): Promise<ProductProfit[]> {
    const response = await axiosInstance.get('/api/admin/sales/by-product', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }
}
