'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { SellerRepository, CreateSellerRequest, UpdateSellerRequest, SellerPageResponse } from '@/domain/repositories/SellerRepository';
import { Seller } from '@/domain/entities/SellerEntity';

export class SellerRepositoryImpl implements SellerRepository {
  async getAll(): Promise<Seller[]> {
    const response = await axiosInstance.get('/api/admin/seller');
    return response.data.data;
  }

  async getById(id: number): Promise<Seller> {
    const response = await axiosInstance.get(`/api/admin/seller/${id}`);
    return response.data.data;
  }

  async getAllPaginated(name: string, page: number, size: number): Promise<SellerPageResponse> {
    const response = await axiosInstance.get('/api/admin/seller', {
      params: { name, page, size },
    });
    return response.data.data;
  }

  async create(data: CreateSellerRequest): Promise<Seller> {
    const response = await axiosInstance.post('/api/admin/seller', data);
    return response.data.data;
  }

  async update(id: number, data: UpdateSellerRequest): Promise<Seller> {
    const response = await axiosInstance.patch(`/api/admin/seller/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/seller/${id}`);
  }
}
