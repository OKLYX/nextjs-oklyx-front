import type { DashboardRepository } from '@/domain/repositories/DashboardRepository';
import type { DashboardLayout, DashboardWebCard } from '@/domain/entities/DashboardEntity';

/** Dashboard use case (FEATURE_2610_29). A thin pass-through — the grid rules live in `dashboardLayout.ts`. */
export class DashboardUseCase {
  constructor(private repository: DashboardRepository) {}

  async getLayout(): Promise<DashboardLayout> {
    return this.repository.getLayout();
  }

  async saveWebLayout(cards: DashboardWebCard[]): Promise<DashboardLayout> {
    return this.repository.saveWebLayout(cards);
  }
}
