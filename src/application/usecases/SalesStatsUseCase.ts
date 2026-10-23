import type { SalesStatsRepository } from '@/domain/repositories/SalesStatsRepository';
import type {
  ChannelSales,
  DailySales,
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
 * Sales aggregate use case (FEATURE_2609_30). Shared by the 「통합 매출 조회」 · 「채널별 매출」 · 「상품별 매출」 tabs
 * and the dashboard sales cards (FEATURE_2610_29).
 */
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

  /** ④ 판매 내역 — 채널별 매출 화면 전용. 🔴 `accountId` 필수. */
  async getSalesLines(params: SalesLinesParams): Promise<SalesLine[]> {
    return this.repository.getSalesLines(params);
  }

  /** ⑤ Sales per sale date — the dashboard chart (FEATURE_2610_29 D22). */
  async getDailySales(params: SalesStatsParams): Promise<DailySales[]> {
    return this.repository.getDailySales(params);
  }
}
