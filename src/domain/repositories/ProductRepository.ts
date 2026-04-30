import type { Product } from '@/domain/entities/Product';

export interface CreateProductRequest {
  productName: string;
  barcodeId: string;
  brand?: string;
  price?: number;
  store?: string;
  unit?: string;
  volumeHeight?: number;
  volumeLong?: number;
  volumeShort?: number;
  weight?: number;
  description?: string;
}

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
  createProduct(data: CreateProductRequest): Promise<Product>;
  uploadProductImage(id: number, file: File): Promise<void>;
  checkBarcodeExists(barcodeId: string): Promise<boolean>;
}
