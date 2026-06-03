export interface CreateProductListingRequest {
  platform: string;
  platformProductId: string;
  sellerId: number;
  categoryId?: number;
  deliveryId?: number;
  packageId?: number;
  options: CreateProductListingOptionWithProductsRequest[];
}

export interface UpdateProductListingRequest {
  platform: string;
  platformProductId: string;
  sellerId: number;
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

export interface CreateProductListingOptionWithProductsRequest {
  optionName: string;
  sellingPrice: number;
  platformOptionId?: string;
  products: CreateProductListingProductRequest[];
}

export interface CreateProductListingProductRequest {
  productId: number;
  quantity: number;
}
