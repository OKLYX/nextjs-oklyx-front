import type { AlertSummary } from '@/domain/entities/AlertEntity';

/**
 * 알림 카운트 조회 (FEATURE_2609_49 / 백엔드 01).
 *
 * ⚠️ 로컬 DB 집계라 마켓을 부르지 않는다 — 짧은 주기로 폴링해도 마켓 호출량이 되지 않는다.
 */
export interface AlertRepository {
  getSummary(): Promise<AlertSummary>;
}
