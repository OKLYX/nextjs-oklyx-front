export interface CreateProductListingRequest {
  platform: string;
  platformProductId: string;
  sellerId: number;
  categoryId?: number;
  deliveryId?: number;
  packageId?: number;
}

export interface UpdateProductListingRequest {
  platform: string;
  platformProductId: string;
  categoryId?: number;
  deliveryId?: number;
  packageId?: number;
}

export interface CreateProductListingOptionRequest {
  productListingId: number;
  optionName: string;
  sellingPrice: number;
  platformOptionId?: string;
}

export interface CreateProductListingProductRequest {
  productListingOptionId: number;
  productId: number;
  quantity: number;
}
