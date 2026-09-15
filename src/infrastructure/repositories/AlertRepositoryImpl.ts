import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { AlertRepository } from '@/domain/repositories/AlertRepository';
import type { AlertSummary } from '@/domain/entities/AlertEntity';

/** `/api/alerts/summary` 호출부 (FEATURE_2609_49 / 백엔드 01). */
export class AlertRepositoryImpl implements AlertRepository {
  async getSummary(): Promise<AlertSummary> {
    const response = await axiosInstance.get('/api/alerts/summary');
    return response.data.data;
  }
}
