import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CommissionRateRepository } from '@/domain/repositories/CommissionRateRepository';
import type { CreateCommissionRateRequest } from '@/application/dto/CreateCommissionRateRequest';
import type { UpdateCommissionRateRequest } from '@/application/dto/UpdateCommissionRateRequest';

export class CommissionRateRepositoryImpl implements CommissionRateRepository {
  async getCommissionRates(): Promise<CommissionRate[]> {
    const response = await axiosInstance.get('/api/admin/commission-rate');
    return response.data.data;
  }

  async createCommissionRate(request: CreateCommissionRateRequest): Promise<CommissionRate> {
    const response = await axiosInstance.post('/api/admin/commission-rate', request);
    return response.data.data;
  }

  async updateCommissionRate(id: number, request: UpdateCommissionRateRequest): Promise<CommissionRate> {
    const response = await axiosInstance.patch(`/api/admin/commission-rate/${id}`, request);
    return response.data.data;
  }
}
