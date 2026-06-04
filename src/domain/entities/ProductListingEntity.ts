export interface ProductListing {
  id: number;
  platform: string;
  platformProductId: string;
  categoryId?: number;
  categoryName?: string;
  deliveryId?: number;
  carrierName?: string;
  packageId?: number;
  packageType?: string;
  sellerId?: number;
  sellerName?: string;
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
