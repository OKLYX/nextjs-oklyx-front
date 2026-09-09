import type { SalesStatsRepository } from '@/domain/repositories/SalesStatsRepository';
import type { ChannelSales, ProductProfit, SellerSales } from '@/domain/entities/SalesSummary';
import type { ProductProfitParams, SalesStatsParams } from '@/application/dto/SalesDTOs';

/** 매출 집계 유스케이스 (FEATURE_2609_30). 매출 현황·상품별 수익성 두 탭이 공유한다. */
export class SalesStatsUseCase {
  constructor(private repository: SalesStatsRepository) {}

  async getSellerSummary(params: SalesStatsParams): Promise<SellerSales[]> {
    return this.repository.getSellerSummary(params);
  }

  async getChannelSales(params: SalesStatsParams): Promise<ChannelSales[]> {
    return this.repository.getChannelSales(params);
  }

  async getProductProfit(params: ProductProfitParams): Promise<ProductProfit[]> {
    return this.repository.getProductProfit(params);
  }
}
