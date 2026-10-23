import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { DashboardRepository } from '@/domain/repositories/DashboardRepository';
import type { DashboardLayout, DashboardWebCard } from '@/domain/entities/DashboardEntity';

/** `/api/dashboard/layout` calls (FEATURE_2610_29). */
export class DashboardRepositoryImpl implements DashboardRepository {
  async getLayout(): Promise<DashboardLayout> {
    const response = await axiosInstance.get('/api/dashboard/layout');
    return response.data.data;
  }

  async saveWebLayout(cards: DashboardWebCard[]): Promise<DashboardLayout> {
    const response = await axiosInstance.put('/api/dashboard/layout/web', { cards });
    return response.data.data;
  }
}
