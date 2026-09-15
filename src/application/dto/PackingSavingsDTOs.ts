/**
 * 포장 절약 조회 파라미터 (FEATURE_2609_41 / 백엔드 01).
 *
 * 날짜는 `yyyy-MM-dd` 문자열 그대로 보낸다(`<input type="date">` 값과 같은 형식).
 * 생략하면 서버 기본값(= `to` 오늘 / `from` 이번 달 1일)이 적용된다.
 *
 * 🔴 여기의 날짜는 <b>포장 완료일</b>이다(PLAN 2609_41 S7) — 매출 파라미터(`SalesStatsParams`)의
 * 판매일과 같은 형식이지만 뜻이 다르다. 그래서 타입을 따로 둔다.
 * 🔴 <b>채널 축을 더하지 말 것</b>(S13) — 포장은 창고 행위라 채널로 나눌 수 없다.
 */
export interface PackingSavingsParams {
  from?: string;
  to?: string;
  /** 생략 = 전 판매자. */
  sellerId?: number;
}
