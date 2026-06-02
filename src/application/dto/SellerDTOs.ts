export interface CreateSellerRequest {
  sellerName: string;
  businessRegistration: string;
}

export interface UpdateSellerRequest {
  sellerName?: string;
  businessRegistration?: string;
}
