import { Seller } from '@/domain/entities/SellerEntity';
import { OptionCheckSuffixRequest } from '@/domain/entities/OptionCheckSuffix';

export interface CreateSellerRequest {
  sellerName: string;
  businessRegistration: string;
}

export interface UpdateSellerRequest {
  sellerName?: string;
  businessRegistration?: string;
}

export interface SellerPageResponse {
  content: Seller[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
}

export interface SellerRepository {
  getAll(): Promise<Seller[]>;
  getById(id: number): Promise<Seller>;
  getAllPaginated(name: string, page: number, size: number): Promise<SellerPageResponse>;
  create(data: CreateSellerRequest): Promise<Seller>;
  update(id: number, data: UpdateSellerRequest): Promise<Seller>;
  updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void>;
  delete(id: number): Promise<void>;
}
