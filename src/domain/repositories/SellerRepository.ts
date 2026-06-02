import { Seller } from '@/domain/entities/SellerEntity';

export interface CreateSellerRequest {
  sellerName: string;
  businessRegistration: string;
}

export interface UpdateSellerRequest {
  sellerName?: string;
  businessRegistration?: string;
}

export interface SellerRepository {
  getAll(): Promise<Seller[]>;
  getById(id: number): Promise<Seller>;
  create(data: CreateSellerRequest): Promise<Seller>;
  update(id: number, data: UpdateSellerRequest): Promise<Seller>;
  delete(id: number): Promise<void>;
}
