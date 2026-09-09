/**
 * 매출 집계 조회 파라미터 (FEATURE_2609_30 / 백엔드 03).
 *
 * 날짜는 `yyyy-MM-dd` 문자열 그대로 보낸다(`<input type="date">` 값과 같은 형식).
 * 생략하면 서버 기본값(= `to` 오늘 / `from` 이번 달 1일)이 적용된다.
 */
export interface SalesStatsParams {
  from?: string;
  to?: string;
  /** 생략 = 전 판매자. */
  sellerId?: number;
}

/** 상품별 수익성 전용 파라미터. */
export interface ProductProfitParams extends SalesStatsParams {
  /** true = 마스터 상품 1행 / false = 마스터 × 채널. 서버 기본값은 true. */
  crossChannel?: boolean;
}
