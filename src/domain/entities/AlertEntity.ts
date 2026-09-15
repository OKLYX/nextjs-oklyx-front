/**
 * 알림 배지 카운트 (GET /api/alerts/summary, FEATURE_2609_49 / D9).
 *
 * 🔴 배지·알림의 **단일 창구**다 — 화면이 자기 목록을 세지 말 것. 범위가 미완결/미답변 **전부**
 * (타입 무관·기간 무관)라 목록 화면의 기본 필터(반품 탭 + 최근 2주)와 다르고,
 * **배지 숫자와 화면 행 수가 일치하지 않는 것이 정상**이다.
 */
export interface AlertSummary {
  /** 미완결 클레임 수(DONE·REJECTED·WITHDRAWN·STALE 이 아닌 것). */
  openClaims: number;
  /** 미답변 고객문의 수. */
  unansweredInquiries: number;
}
