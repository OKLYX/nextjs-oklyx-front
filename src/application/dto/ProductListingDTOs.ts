export interface UpdateProductListingRequest {
  platform: string;
  platformProductId: string;
  name: string;
  sellerId: number;
  categoryId?: number;
  deliveryId?: number;
  packageId?: number;
  options: UpdateProductListingOptionRequest[];
}

/**
 * 2609_71/D8: 구성품(`products`)은 더 이상 보내지 않는다.
 * 옵션 ↔ 물품 매핑은 마스터(`master_product_option_item`)가 정본이고,
 * 판매상품 화면은 읽기 전용으로 보여주기만 한다.
 */
export interface UpdateProductListingOptionRequest {
  id?: number;
  optionName: string;
  sellingPrice: number;
  platformOptionId?: string;
}
