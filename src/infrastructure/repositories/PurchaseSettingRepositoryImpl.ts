import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PurchaseSettingRepository } from '@/domain/repositories/PurchaseSettingRepository';
import type { PurchaseSetting } from '@/domain/entities/PurchaseSettingEntity';

export class PurchaseSettingRepositoryImpl implements PurchaseSettingRepository {
  async get(): Promise<PurchaseSetting> {
    const response = await axiosInstance.get('/api/admin/purchase-settings');
    return response.data.data;
  }

  async update(setting: PurchaseSetting): Promise<PurchaseSetting> {
    const response = await axiosInstance.put('/api/admin/purchase-settings', setting);
    return response.data.data;
  }
}
