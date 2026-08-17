// MasterProduct (판매상품 마스터) domain types — mirror of the backend confirmed fields.
// Backend endpoints are all /api/admin/master-products/** (ADMIN-only).

export interface MasterComponent {
  productId: number;
  productName: string;
}

export interface MasterOptionItem {
  productId: number;
  productName: string;
  quantity: number;
}

export interface MasterOptionResponse {
  id: number;
  name: string;
  items: MasterOptionItem[];
}

export interface MasterProductResponse {
  id: number;
  name: string;
  active: boolean;
  sourceImageUrl: string | null;
  detailSource: string | null;
  fieldValues: Record<string, string>;
  components: MasterComponent[];
  options: MasterOptionResponse[];
}

// Requests
export interface MasterProductRequest {
  name: string;
  componentProductIds: number[];
  detailSource?: string;
  fieldValues?: Record<string, string>;
}

export interface MasterProductUpdateRequest {
  name?: string;
  detailSource?: string;
  fieldValues?: Record<string, string>;
  active?: boolean;
  componentProductIds?: number[];
}

export interface MasterOptionRequestItem {
  productId: number;
  quantity: number;
}

export interface MasterOptionRequest {
  name: string;
  items: MasterOptionRequestItem[];
}

// Coverage matrix (accounts × listings)
export interface MatrixCell {
  productListingId: number;
  platformProductId: string | null;
  sellingPrice: number | null;
}

export interface MatrixRow {
  sellerId: number;
  sellerName: string;
  platform: string;
  accountId: number;
  accountLabel: string;
  registered: boolean;
  cell: MatrixCell | null;
}

export interface ListingMatrixResponse {
  masterId: number;
  masterName: string;
  rows: MatrixRow[];
}
