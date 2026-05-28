import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CommissionRateRepository } from '@/domain/repositories/CommissionRateRepository';

export class CommissionRateRepositoryImpl implements CommissionRateRepository {
  async getCommissionRates(): Promise<CommissionRate[]> {
    const response = await axiosInstance.get('/api/admin/commission-rate');
    return response.data.data;
  }
}
