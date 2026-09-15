import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PackingSavingsRepository } from '@/domain/repositories/PackingSavingsRepository';
import type {
  BoxSaving,
  OptionSaving,
  SavingsSummary,
} from '@/domain/entities/PackingSavingsEntity';
import type { PackingSavingsParams } from '@/application/dto/PackingSavingsDTOs';

/**
 * `/api/admin/packing/savings/**` 호출부 (FEATURE_2609_41 / 백엔드 01).
 *
 * ⚠️ 빈 값 키는 아예 보내지 않는다 — `from=` 을 보내면 서버 기본값이 아니라 400 이 된다.
 */
export class PackingSavingsRepositoryImpl implements PackingSavingsRepository {
  private toQuery(params: PackingSavingsParams): Record<string, string | number> {
    const query: Record<string, string | number> = {};
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.sellerId != null) query.sellerId = params.sellerId;
    return query;
  }

  async getSummary(params: PackingSavingsParams): Promise<SavingsSummary> {
    const response = await axiosInstance.get('/api/admin/packing/savings/summary', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }

  async getOptions(params: PackingSavingsParams): Promise<OptionSaving[]> {
    const response = await axiosInstance.get('/api/admin/packing/savings/options', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }

  async getBoxes(params: PackingSavingsParams): Promise<BoxSaving[]> {
    const response = await axiosInstance.get('/api/admin/packing/savings/boxes', {
      params: this.toQuery(params),
    });
    return response.data.data;
  }
}
