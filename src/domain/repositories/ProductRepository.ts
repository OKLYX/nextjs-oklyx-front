import type { Product } from '@/domain/entities/Product';

/**
 * ⚠️ 높이/길이/너비/내용물 양은 **문자열**이다 — 서버 컬럼이 `VARCHAR(255)` 라 `"160mm"` 처럼
 * 단위를 붙여 담는다. 숫자로 바꿔 보내지 말 것: 단위가 섞인 값은 `Number()` 가 `NaN` 을 내고
 * JSON 에서 `null` 이 되는데, 서버는 그 `null` 을 "이 항목은 안 보냄"으로 읽어 기존 값을
 * 그대로 다시 저장한다(= 수정이 조용히 무시됨, 2026-09-20 실제 버그).
 */
export interface CreateProductRequest {
  productName: string;
  barcodeId?: string;
  brand?: string;
  price?: number;
  store?: string;
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  description?: string;
}

export interface UpdateProductRequest {
  productName?: string;
  barcodeId?: string;
  brand?: string | null;
  price?: number | null;
  store?: string | null;
  netContentUnit?: string | null;
  packageHeight?: string | null;
  packageLength?: string | null;
  packageWidth?: string | null;
  netContent?: string | null;
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
