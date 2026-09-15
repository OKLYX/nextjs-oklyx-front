import type { AlertRepository } from '@/domain/repositories/AlertRepository';
import type { AlertFeedPage, AlertFeedQuery, AlertSummary } from '@/domain/entities/AlertEntity';

/** 알림 유스케이스 (FEATURE_2609_49 · FEATURE_2609_51). 얇은 위임 — 표시 규칙은 훅·컴포넌트가 갖는다. */
export class AlertUseCase {
  constructor(private repository: AlertRepository) {}

  async getSummary(): Promise<AlertSummary> {
    return this.repository.getSummary();
  }

  async getFeed(query?: AlertFeedQuery): Promise<AlertFeedPage> {
    return this.repository.getFeed(query);
  }
}
