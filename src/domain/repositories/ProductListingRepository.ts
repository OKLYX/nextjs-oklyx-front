import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export interface ProductListingRepository {
  getProductListingById(id: number): Promise<ProductListing>;
  getProductListingsByPlatform(
    platform: string,
    page: number,
    size: number
  ): Promise<{
    content: ProductListing[];
    totalElements: number;
    totalPages: number;
  }>;
  createProductListing(
    request: CreateProductListingRequest
  ): Promise<ProductListing>;
  updateProductListing(
    id: number,
    request: UpdateProductListingRequest
  ): Promise<ProductListing>;
  deleteProductListing(id: number): Promise<void>;
}
