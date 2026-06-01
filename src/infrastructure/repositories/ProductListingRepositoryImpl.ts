import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProductListingRepository } from '@/domain/repositories/ProductListingRepository';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export class ProductListingRepositoryImpl implements ProductListingRepository {
  async getProductListingById(id: number): Promise<ProductListing> {
    const response = await axiosInstance.get(`/api/product-listings/${id}`);
    return response.data.data;
  }

  async getProductListingsByPlatform(platform: string, page: number, size: number) {
    const response = await axiosInstance.get('/api/product-listings', {
      params: { platform, page, size },
    });
    return response.data.data;
  }

  async createProductListing(request: CreateProductListingRequest): Promise<ProductListing> {
    const response = await axiosInstance.post('/api/product-listings', request);
    return response.data.data;
  }

  async updateProductListing(id: number, request: UpdateProductListingRequest): Promise<ProductListing> {
    const response = await axiosInstance.patch(`/api/product-listings/${id}`, request);
    return response.data.data;
  }

  async deleteProductListing(id: number): Promise<void> {
    await axiosInstance.delete(`/api/product-listings/${id}`);
  }
}
