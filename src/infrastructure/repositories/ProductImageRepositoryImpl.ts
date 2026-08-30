'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProductImageRepository } from '@/domain/repositories/ProductImageRepository';
import type { ProductImage } from '@/domain/entities/ProductImage';

const base = (productId: number) => `/api/admin/products/${productId}/images`;

export class ProductImageRepositoryImpl implements ProductImageRepository {
  async list(productId: number): Promise<ProductImage[]> {
    const response = await axiosInstance.get(base(productId));
    return response.data.data;
  }

  async add(productId: number, files: File[]): Promise<ProductImage[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await axiosInstance.post(base(productId), formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async replace(productId: number, imageId: number, file: File): Promise<ProductImage> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.put(`${base(productId)}/${imageId}`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async reorder(productId: number, imageIds: number[]): Promise<ProductImage[]> {
    const response = await axiosInstance.put(`${base(productId)}/reorder`, { imageIds });
    return response.data.data;
  }

  async remove(productId: number, imageId: number): Promise<void> {
    await axiosInstance.delete(`${base(productId)}/${imageId}`);
  }
}
