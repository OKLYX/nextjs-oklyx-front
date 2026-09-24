import type { ProductListing, ProductListingOption } from '@/domain/entities/ProductListingEntity';
import type { UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export interface ProductListingRepository {
  getProductListingById(id: number): Promise<ProductListing>;
  /**
   * 2609_22/D24: `masterLinked` 는 optional 3값이다 —
   * `false` = 마스터 미연결만, `true` = 연결된 것만, 미지정 = 전체(기존 동작).
   *
   * `search` 는 선택 — 상품명 부분일치 + 마켓 상품 ID 정확일치(서버가 소유하는 규칙).
   * 빈 문자열/공백은 "검색 없음"이다(서버가 trim 한다).
   */
  getProductListingsByPlatform(
    platform: string,
    page: number,
    size: number,
    masterLinked?: boolean,
    search?: string
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
