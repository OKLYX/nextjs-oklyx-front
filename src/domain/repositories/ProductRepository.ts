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
  /** 구매처 id 목록(FEATURE_2609_76). 비면 구매처 없음. */
  purchasePlaceIds?: number[];
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  /** 개수(1 이상 정수). `countUnit` 과 함께 보내거나 둘 다 뺀다. */
  countQuantity?: number;
  countUnit?: string;
  description?: string;
}

export interface UpdateProductRequest {
  productName?: string;
  barcodeId?: string;
  brand?: string | null;
  price?: number | null;
  /** 구매처 id 목록 — 보내면 이 목록으로 **통째로** 바뀐다(`[]` = 전부 지움). */
  purchasePlaceIds?: number[];
  netContentUnit?: string | null;
  packageHeight?: string | null;
  packageLength?: string | null;
  packageWidth?: string | null;
  netContent?: string | null;
  /**
   * 🔴 개수 쌍은 `countUnit` 을 보내면 통째로 바뀐다 — 그때 `countQuantity` 가 null 이면 개수가 지워진다.
   * 지우기 = `countUnit: ''` + `countQuantity: null`. 수정 화면은 두 칸을 항상 함께 보낸다.
   */
  countQuantity?: number | null;
  countUnit?: string | null;
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

/**
 * Result of reading a barcode from an uploaded photo (POST /api/admin/products/barcode-scan).
 * `barcode === null` means the server found no readable barcode in the image. The image is not stored.
 */
export interface BarcodeScanResult {
  barcode: string | null;
  format: string | null;
}

export interface ProductRepository {
  getProducts(params: GetProductsParams): Promise<GetProductsResponse>;
  getProductDetail(id: number): Promise<Product>;
  createProduct(data: CreateProductRequest): Promise<Product>;
  uploadProductImage(id: number, file: File): Promise<Product>;
  checkBarcodeExists(barcodeId: string): Promise<boolean>;
  scanBarcodeFromImage(file: File): Promise<BarcodeScanResult>;
  updateProduct(id: number, data: UpdateProductRequest): Promise<Product>;
  deleteProductImage(id: number): Promise<void>;
}
