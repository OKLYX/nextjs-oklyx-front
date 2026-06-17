'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import {
  MarketplaceAccountRepository,
  CreateMarketplaceAccountRequest,
  UpdateMarketplaceAccountRequest,
} from '@/domain/repositories/MarketplaceAccountRepository';
import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';

export class MarketplaceAccountRepositoryImpl implements MarketplaceAccountRepository {
  async getBySeller(sellerId: number): Promise<MarketplaceAccount[]> {
    const response = await axiosInstance.get('/api/admin/marketplace-account', {
      params: { sellerId },
    });
    return response.data.data;
  }

  async create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount> {
    const response = await axiosInstance.post('/api/admin/marketplace-account', data);
    return response.data.data;
  }

  async update(id: number, data: UpdateMarketplaceAccountRequest): Promise<MarketplaceAccount> {
    const response = await axiosInstance.patch(`/api/admin/marketplace-account/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/marketplace-account/${id}`);
  }
}
