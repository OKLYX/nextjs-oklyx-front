'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { SellerRepository, CreateSellerRequest, UpdateSellerRequest } from '@/domain/repositories/SellerRepository';
import { Seller } from '@/domain/entities/SellerEntity';

export class SellerRepositoryImpl implements SellerRepository {
  async getAll(): Promise<Seller[]> {
    const response = await axiosInstance.get('/api/sellers');
    return response.data.data;
  }

  async getById(id: number): Promise<Seller> {
    const response = await axiosInstance.get(`/api/sellers/${id}`);
    return response.data.data;
  }

  async create(data: CreateSellerRequest): Promise<Seller> {
    const response = await axiosInstance.post('/api/sellers', data);
    return response.data.data;
  }

  async update(id: number, data: UpdateSellerRequest): Promise<Seller> {
    const response = await axiosInstance.patch(`/api/sellers/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await axiosInstance.delete(`/api/sellers/${id}`);
  }
}
