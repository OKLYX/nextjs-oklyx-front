import type { Product } from '@/domain/entities/Product';

export interface CreateProductRequest {
  productName: string;
  barcodeId?: string;
  brand?: string;
  price?: number;
  store?: string;
  netContentUnit?: string;
  packageHeight?: number;
  packageLength?: number;
  packageWidth?: number;
  netContent?: number;
  description?: string;
}

export interface UpdateProductRequest {
  productName?: string;
  barcodeId?: string;
  brand?: string | null;
  price?: number | null;
  store?: string | null;
  netContentUnit?: string | null;
  packageHeight?: string | number | null;
  packageLength?: string | number | null;
  packageWidth?: string | number | null;
  netContent?: string | number | null;
  description?: string | null;
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
  uploadProductImage(id: number, file: File): Promise<Product>;
  checkBarcodeExists(barcodeId: string): Promise<boolean>;
  updateProduct(id: number, data: UpdateProductRequest): Promise<Product>;
  deleteProductImage(id: number): Promise<void>;
}
