import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { CarrierRateRepository } from '@/domain/repositories/CarrierRateRepository';

export class CarrierRateRepositoryImpl implements CarrierRateRepository {
  async getCarrierRates(): Promise<CarrierRate[]> {
    const response = await axiosInstance.get('/api/admin/carrier-rate');
    return response.data.data;
  }

  async createCarrierRate(data: {
    carrier: string;
    type: string;
    cost: number;
    effectiveDate: string;
    isDefault: boolean;
  }): Promise<CarrierRate> {
    const response = await axiosInstance.post('/api/admin/carrier-rate', data);
    return response.data.data;
  }

  async updateCarrierRate(
    id: number,
    data: {
      carrier: string;
      type: string;
      cost: number;
      effectiveDate: string;
      isDefault: boolean;
    }
  ): Promise<CarrierRate> {
    const response = await axiosInstance.patch(`/api/admin/carrier-rate/${id}`, data);
    return response.data.data;
  }
}
