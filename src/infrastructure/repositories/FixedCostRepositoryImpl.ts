import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  CreateFixedCostRequest,
  PlatformFixedCost,
  UpdateFixedCostRequest,
} from '@/domain/entities/FixedCost';
import type { FixedCostRepository } from '@/domain/repositories/FixedCostRepository';

export class FixedCostRepositoryImpl implements FixedCostRepository {
  async list(): Promise<PlatformFixedCost[]> {
    const response = await axiosInstance.get('/api/admin/fixed-costs');
    return response.data.data;
  }

  async create(data: CreateFixedCostRequest): Promise<PlatformFixedCost> {
    const response = await axiosInstance.post('/api/admin/fixed-costs', data);
    return response.data.data;
  }

  async update(id: number, data: UpdateFixedCostRequest): Promise<PlatformFixedCost> {
    const response = await axiosInstance.patch(`/api/admin/fixed-costs/${id}`, data);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/fixed-costs/${id}`);
  }

  async listForAccount(accountId: number): Promise<AccountFixedCost[]> {
    const response = await axiosInstance.get(`/api/admin/marketplace-account/${accountId}/fixed-costs`);
    return response.data.data;
  }

  async setForAccount(accountId: number, items: AccountFixedCostRequestItem[]): Promise<void> {
    await axiosInstance.put(`/api/admin/marketplace-account/${accountId}/fixed-costs`, { items });
  }
}
