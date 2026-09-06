export interface ProductListing {
  id: number;
  platform: string;
  platformProductId: string;
  name: string;
  categoryId?: number;
  categoryName?: string;
  deliveryId?: number;
  carrierName?: string;
  packageId?: number;
  packageType?: string;
  sellerId?: number;
  sellerName?: string;
  // 2609_22/D24: null/undefined = 마스터 미연결(= [마스터 생성] 대상). 값이 있으면 legacy 수정 불가(D32).
  masterProductId?: number | null;
  options?: ProductListingOption[];
}

export interface ProductListingOption {
  id: number;
  productListingId: number;
  optionName: string;
  sellingPrice: number;
  platformOptionId?: string;
  margin?: number;
  marginRate?: number;
  products?: ProductListingProduct[];
}

export interface ProductListingProduct {
  id: number;
  productListingOptionId: number;
  productId: number;
  productName: string;
  quantity: number;
}

/**
 * 2609_22/D24: 판매상품 → 마스터 생성 미리보기의 옵션 대조 한 줄.
 * 표시 전용이다 — 실제 값 확정(옵션 id 교정 포함)은 서버가 커밋 때 쿠팡을 다시 읽어 처리한다(D27).
 */
export interface ListingMasterOptionDiff {
  optionName: string;
  coupangItemName: string;
  currentOptionId: string | null;
  coupangVendorItemId: string | null;
  optionIdMismatch: boolean;
  currentPrice: number;
  coupangPrice: number;
  priceMismatch: boolean;
}

/** 2609_22/D24: 마스터 미연결 셀을 쿠팡 원본과 대조한 리포트(쓰기 없음). */
export interface ListingMasterPreview {
  listingName: string;
  coupangProductName: string;
  suggestedMasterName: string;                 // D25 프리필
  status: string;
  categoryCode: string;
  suggestedCategoryId: number | null;          // null = 사용자가 직접 골라야 한다 (D26)
  suggestedCategoryName: string | null;
  components: { productId: number; brand?: string; productName: string }[];
  options: ListingMasterOptionDiff[];
  coupangOnlyOptions: string[];                // D30 경고용 — 가져오지 않는다
}

/**
 * 2609_22/D24: 마스터 생성 요청. 옵션·가격·구성은 일부러 보내지 않는다 —
 * 서버가 셀 + 쿠팡 재조회로 확정한다. 사용자가 정하는 것은 이름과 표준 카테고리뿐이다.
 */
export interface ListingMasterCreateRequest {
  masterName: string;
  categoryId: number;
}

/** 2609_22/D24: 마스터 생성 결과. `masterProductId` 로 마스터 상세로 이동한다. */
export interface ListingMasterCreateResult {
  masterProductId: number;
  productListingId: number;
  optionCount: number;
}
