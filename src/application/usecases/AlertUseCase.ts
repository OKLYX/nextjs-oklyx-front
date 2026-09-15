import type { AlertRepository } from '@/domain/repositories/AlertRepository';
import type { AlertSummary } from '@/domain/entities/AlertEntity';

/** 알림 카운트 유스케이스 (FEATURE_2609_49). 얇은 위임 — 표시 규칙은 훅·컴포넌트가 갖는다. */
export class AlertUseCase {
  constructor(private repository: AlertRepository) {}

  async getSummary(): Promise<AlertSummary> {
    return this.repository.getSummary();
  }
}
