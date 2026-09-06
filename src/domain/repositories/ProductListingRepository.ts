import type { ProductListing, ProductListingOption, ProductListingProduct, ListingMasterPreview, ListingMasterCreateRequest, ListingMasterCreateResult } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest, CreateProductListingOptionRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';

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
  createProductListing(
    request: CreateProductListingRequest
  ): Promise<ProductListing>;
  updateProductListing(
    id: number,
    request: UpdateProductListingRequest
  ): Promise<ProductListing>;
  deleteProductListing(id: number): Promise<void>;
  getProductListingOptions(listingId: number): Promise<ProductListingOption[]>;
  addProductListingOption(request: CreateProductListingOptionRequest): Promise<ProductListingOption>;
  addProductListingProduct(request: CreateProductListingProductRequest): Promise<ProductListingProduct>;
  /** 2609_22/D24: 마스터 생성 미리보기(ADMIN). 저장 0회 — 쿠팡 대조 리포트만 돌려준다. */
  previewMasterFromListing(listingId: number): Promise<ListingMasterPreview>;
  /** 2609_22/D24: 이 셀로 마스터를 만들고 셀·옵션을 연결한다(ADMIN). */
  createMasterFromListing(
    listingId: number,
    request: ListingMasterCreateRequest
  ): Promise<ListingMasterCreateResult>;
}
