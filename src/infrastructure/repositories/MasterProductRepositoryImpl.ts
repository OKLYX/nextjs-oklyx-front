'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  MasterCategoryRequest,
  MasterCategoryResponse,
  ListingMatrixResponse,
} from '@/domain/entities/MasterProductEntity';

const base = '/api/admin/master-products';

export class MasterProductRepositoryImpl implements MasterProductRepository {
  async list(): Promise<MasterProductResponse[]> {
    const response = await axiosInstance.get(base);
    return response.data.data;
  }

  async getById(id: number): Promise<MasterProductResponse> {
    const response = await axiosInstance.get(`${base}/${id}`);
    return response.data.data;
  }

  async create(data: MasterProductRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.post(base, data);
    return response.data.data;
  }

  async update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.patch(`${base}/${id}`, data);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }

  async uploadImage(id: number, file: File): Promise<MasterProductResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`${base}/${id}/image`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async addOption(id: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    const response = await axiosInstance.post(`${base}/${id}/options`, data);
    return response.data.data;
  }

  async updateOption(id: number, optionId: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    const response = await axiosInstance.patch(`${base}/${id}/options/${optionId}`, data);
    return response.data.data;
  }

  async deleteOption(id: number, optionId: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}/options/${optionId}`);
  }

  async getMatrix(id: number): Promise<ListingMatrixResponse> {
    const response = await axiosInstance.get(`${base}/${id}/matrix`);
    return response.data.data;
  }

  async upsertCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse> {
    const response = await axiosInstance.put(`${base}/${id}/category`, data);
    return response.data.data;
  }

  async getCategories(id: number): Promise<MasterCategoryResponse[]> {
    const response = await axiosInstance.get(`${base}/${id}/categories`);
    return response.data.data;
  }

  async deleteCategory(id: number, platform: string): Promise<void> {
    await axiosInstance.delete(`${base}/${id}/categories/${platform}`);
  }
}
