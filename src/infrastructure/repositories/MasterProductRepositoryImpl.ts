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
  CategoryMetaResponse,
  CategoryMetaSchemaResponse,
  CategoryAttributesRequest,
  ListingMatrixResponse,
  TagsUpdateRequest,
} from '@/domain/entities/MasterProductEntity';

const base = '/api/admin/master-products';
const lookupBase = '/api/admin/category-lookup';

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

  async getCategory(id: number): Promise<MasterCategoryResponse | null> {
    const response = await axiosInstance.get(`${base}/${id}/category`);
    const data = response.data.data;
    // Backend returns { categoryId: null, categoryName: null } when unset.
    return data && data.categoryId != null ? data : null;
  }

  async setCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse> {
    const response = await axiosInstance.put(`${base}/${id}/category`, data);
    return response.data.data;
  }

  async clearCategory(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}/category`);
  }

  async getCategoryMeta(id: number, platform: string): Promise<CategoryMetaResponse> {
    const response = await axiosInstance.get(`${base}/${id}/category-meta`, { params: { platform } });
    return response.data.data;
  }

  async getCategorySchema(categoryId: number, platform: string): Promise<CategoryMetaSchemaResponse> {
    const response = await axiosInstance.get(`${lookupBase}/${platform}/meta`, {
      params: { categoryId },
    });
    return response.data.data;
  }

  async setCategoryAttributes(id: number, data: CategoryAttributesRequest): Promise<void> {
    await axiosInstance.patch(`${base}/${id}/category-attributes`, data);
  }

  async updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.patch(`${base}/${id}/tags`, data);
    return response.data.data;
  }
}
