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
  // 2609_22/D24: null/undefined = 마스터 미연결. 값이 있으면 legacy 수정 불가(D32).
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

/**
 * 2609_71: 옵션의 구성품 한 줄. **읽기 전용**이다 — 정본은 마스터(`master_product_option_item`)이고
 * 서버가 마스터를 타고 채워 내려준다. 화면에서 고르거나 보내지 않는다.
 */
export interface ProductListingProduct {
  id: number;
  productListingOptionId: number;
  productId: number;
  productName: string;
  quantity: number;
}
