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
}

export interface ProductListingOption {
  id: number;
  productListingId: number;
  optionName: string;
  sellingPrice: number;
  platformOptionId?: string;
  margin?: number;
  marginRate?: number;
}

export interface ProductListingProduct {
  id: number;
  productListingOptionId: number;
  productId: number;
  productName: string;
  quantity: number;
}
