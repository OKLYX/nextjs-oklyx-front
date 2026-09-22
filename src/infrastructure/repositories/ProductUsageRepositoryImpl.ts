import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { ProductUsageRepository } from '@/domain/repositories/ProductUsageRepository';

export class ProductUsageRepositoryImpl implements ProductUsageRepository {
  async getUsage(productId: number): Promise<ProductUsage> {
    const response = await axiosInstance.get(`/api/products/${productId}/usage`);
    return response.data.data;
  }
}
