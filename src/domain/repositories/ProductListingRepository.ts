import type { ProductListing, ProductListingOption } from '@/domain/entities/ProductListingEntity';
import type { UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export interface ProductListingRepository {
  getProductListingById(id: number): Promise<ProductListing>;
  /**
   * 2609_22/D24: `masterLinked` 는 optional 3값이다 —
   * `false` = 마스터 미연결만, `true` = 연결된 것만, 미지정 = 전체(기존 동작).
   */
  getProductListingsByPlatform(
    platform: string,
    page: number,
    size: number,
    masterLinked?: boolean
  ): Promise<{
    content: ProductListing[];
    totalElements: number;
    totalPages: number;
  }>;
  updateProductListing(
    id: number,
    request: UpdateProductListingRequest
  ): Promise<ProductListing>;
  deleteProductListing(id: number): Promise<void>;
  getProductListingOptions(listingId: number): Promise<ProductListingOption[]>;
}
