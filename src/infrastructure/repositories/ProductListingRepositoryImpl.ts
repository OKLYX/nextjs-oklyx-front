import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProductListingRepository } from '@/domain/repositories/ProductListingRepository';
import type { ProductListing, ProductListingOption, ProductListingProduct, ListingMasterPreview, ListingMasterCreateRequest, ListingMasterCreateResult } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest, CreateProductListingOptionRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';

export class ProductListingRepositoryImpl implements ProductListingRepository {
  async getProductListingById(id: number): Promise<ProductListing> {
    const response = await axiosInstance.get(`/api/product-listings/${id}`);
    return response.data.data;
  }

  async getProductListingsByPlatform(
    platform: string,
    page: number,
    size: number,
    masterLinked?: boolean
  ) {
    const response = await axiosInstance.get('/api/product-listings', {
      // 미지정이면 파라미터 자체를 보내지 않는다 — 백엔드의 3값(null/true/false) 계약.
      params: { platform, page, size, ...(masterLinked === undefined ? {} : { masterLinked }) },
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

  async getProductListingOptions(listingId: number): Promise<ProductListingOption[]> {
    const response = await axiosInstance.get('/api/product-listings-options', {
      params: { listingId },
    });
    return response.data.data;
  }

  async addProductListingOption(request: CreateProductListingOptionRequest): Promise<ProductListingOption> {
    const response = await axiosInstance.post('/api/product-listings-options', request);
    return response.data.data;
  }

  async addProductListingProduct(request: CreateProductListingProductRequest): Promise<ProductListingProduct> {
    const response = await axiosInstance.post('/api/product-listings-products', request);
    return response.data.data;
  }

  async previewMasterFromListing(listingId: number): Promise<ListingMasterPreview> {
    const response = await axiosInstance.post(`/api/admin/product-listings/${listingId}/master/preview`);
    return response.data.data;
  }

  async createMasterFromListing(
    listingId: number,
    request: ListingMasterCreateRequest
  ): Promise<ListingMasterCreateResult> {
    const response = await axiosInstance.post(`/api/admin/product-listings/${listingId}/master`, request);
    return response.data.data;
  }
}
