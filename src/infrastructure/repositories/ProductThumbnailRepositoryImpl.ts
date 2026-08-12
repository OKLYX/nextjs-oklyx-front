'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProductThumbnailRepository } from '@/domain/repositories/ProductThumbnailRepository';
import type { ProductThumbnail } from '@/domain/entities/ThumbnailEntity';

const base = (productId: number) => `/api/admin/products/${productId}/thumbnails`;

export class ProductThumbnailRepositoryImpl implements ProductThumbnailRepository {
  async listByProduct(productId: number): Promise<ProductThumbnail[]> {
    const response = await axiosInstance.get(base(productId));
    return response.data.data;
  }

  async generate(productId: number, sellerId: number): Promise<ProductThumbnail> {
    const response = await axiosInstance.post(`${base(productId)}/generate`, null, {
      params: { sellerId },
    });
    return response.data.data;
  }

  async override(productId: number, sellerId: number, file: File): Promise<ProductThumbnail> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`${base(productId)}/${sellerId}/override`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async remove(productId: number, sellerId: number): Promise<void> {
    await axiosInstance.delete(`${base(productId)}/${sellerId}`);
  }
}
