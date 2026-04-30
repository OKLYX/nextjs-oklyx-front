import type { Product } from '@/domain/entities/Product';

export interface GetProductsParams {
  page: number;
  size: number;
  search?: string;
}

export interface GetProductsResponse {
  content: Product[];
  totalPages: number;
  totalElements: number;
  first: boolean;
  last: boolean;
}

export interface ProductRepository {
  getProducts(params: GetProductsParams): Promise<GetProductsResponse>;
  getProductDetail(id: number): Promise<Product>;
}
