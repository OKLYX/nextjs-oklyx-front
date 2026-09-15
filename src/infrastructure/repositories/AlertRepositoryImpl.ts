import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { AlertRepository } from '@/domain/repositories/AlertRepository';
import type { AlertFeedPage, AlertFeedQuery, AlertSummary } from '@/domain/entities/AlertEntity';

/** `/api/alerts` 호출부 (FEATURE_2609_49 / 백엔드 01 · FEATURE_2609_51 / 백엔드 01). */
export class AlertRepositoryImpl implements AlertRepository {
  async getSummary(): Promise<AlertSummary> {
    const response = await axiosInstance.get('/api/alerts/summary');
    return response.data.data;
  }

  async getFeed(query: AlertFeedQuery = {}): Promise<AlertFeedPage> {
    // ⚠️ undefined 인 값은 키째 뺀다 — `type=undefined` 를 문자열로 실어 보내면 서버가 400 을 낸다.
    const params = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.size != null ? { size: query.size } : {}),
    };
    const response = await axiosInstance.get('/api/alerts', { params });
    return response.data.data;
  }
}
