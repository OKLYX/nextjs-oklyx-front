import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { SellerCardRepository } from '@/domain/repositories/SellerCardRepository';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { CreateSellerCardRequest, UpdateSellerCardRequest } from '@/application/dto/SellerCardDTOs';

export class SellerCardRepositoryImpl implements SellerCardRepository {
  async getVisible(): Promise<SellerCard[]> {
    const response = await axiosInstance.get('/api/admin/seller-cards');
    return response.data.data;
  }

  async create(request: CreateSellerCardRequest): Promise<SellerCard> {
    const response = await axiosInstance.post('/api/admin/seller-cards', request);
    return response.data.data;
  }

  async update(cardId: number, request: UpdateSellerCardRequest): Promise<SellerCard> {
    const response = await axiosInstance.put(`/api/admin/seller-cards/${cardId}`, request);
    return response.data.data;
  }

  async hide(cardId: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/seller-cards/${cardId}`);
  }
}
