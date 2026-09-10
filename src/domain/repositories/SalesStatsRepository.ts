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
 * 매출 집계 API (FEATURE_2609_30 / 백엔드 03). 전 경로가 `/api/admin/sales/**` — ADMIN 전용(PLAN D17).
 *
 * ⚠️ 전부 로컬 DB 집계라 마켓을 부르지 않는다. 화면이 자주 열려도 마켓 호출량이 되지 않는다.
 * ⚠️ 정산 원장(`/api/admin/settlement/**`)은 이 인터페이스가 아니다 — 05 가 별도 레포를 만든다.
 */
export interface SalesStatsRepository {
  /** ① 판매자별 요약. */
  getSellerSummary(params: SalesStatsParams): Promise<SellerSales[]>;
  /** ② 채널(계정)별. 판매자 행을 펼칠 때 그 판매자로 좁혀 부른다. */
  getChannelSales(params: SalesStatsParams): Promise<ChannelSales[]>;
  /** ③ 상품별 수익성. `crossChannel` 은 서버 파라미터라 값이 바뀌면 재조회한다. */
  getProductProfit(params: ProductProfitParams): Promise<ProductProfit[]>;
  /** ④ 판매 내역 — 한 채널의 주문 라인 목록. 🔴 `accountId` 필수(없으면 서버 400). */
  getSalesLines(params: SalesLinesParams): Promise<SalesLine[]>;
}
