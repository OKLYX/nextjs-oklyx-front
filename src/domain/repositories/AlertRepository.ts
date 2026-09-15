import type { AlertFeedPage, AlertFeedQuery, AlertSummary } from '@/domain/entities/AlertEntity';

/**
 * 알림 조회 (FEATURE_2609_49 / 백엔드 01 · FEATURE_2609_51 / 백엔드 01).
 *
 * ⚠️ 로컬 DB 집계라 마켓을 부르지 않는다 — 짧은 주기로 폴링해도 마켓 호출량이 되지 않는다.
 * 🔴 카운트 창구는 `getSummary` 하나다(D11). 항목이 늘면 `AlertSummary` 에 필드를 더한다.
 */
export interface AlertRepository {
  getSummary(): Promise<AlertSummary>;
  /** 처리해야 할 일 목록 한 장. 커서는 이전 응답의 `nextCursor` 를 그대로 돌려보낸다(D12). */
  getFeed(query?: AlertFeedQuery): Promise<AlertFeedPage>;
}
