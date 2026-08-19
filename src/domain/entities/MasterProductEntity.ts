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
  deliveryId: number | null; // carrier override; null = use master default
  packageId: number | null; // box override; null = use master default
}

export interface MasterProductResponse {
  id: number;
  name: string;
  active: boolean;
  sourceImageUrl: string | null;
  fieldValues: Record<string, string>;
  defaultDeliveryId: number | null; // default carrier for the price engine
  defaultPackageId: number | null; // default box for the price engine
  components: MasterComponent[];
  options: MasterOptionResponse[];
  tags: string[]; // master tag pool (backend null -> treat as [] in the UI)
  // Computed registration name (prompt 32). Present only on getById (single fetch);
  // the list response omits the field entirely, so it is undefined there.
  registrationName?: string | null;
}

// Tags PATCH body, shared by master pool and channel raw endpoints.
export interface TagsUpdateRequest {
  tags: string[];
}

// Requests
export interface MasterProductRequest {
  name: string;
  componentProductIds: number[];
  fieldValues?: Record<string, string>;
  defaultDeliveryId?: number;
  defaultPackageId?: number;
  options?: MasterOptionRequest[]; // atomic create; each option covers the full component set
}

export interface MasterProductUpdateRequest {
  name?: string;
  fieldValues?: Record<string, string>;
  active?: boolean;
  componentProductIds?: number[];
  defaultDeliveryId?: number; // omit = keep existing (backend PATCH null = keep)
  defaultPackageId?: number;
}

export interface MasterOptionRequestItem {
  productId: number;
  quantity: number;
}

export interface MasterOptionRequest {
  name: string;
  items: MasterOptionRequestItem[];
  deliveryId?: number; // omit = keep existing; set = replace override
  packageId?: number;
}

// Master category (master × platform); backend 13.
export interface MasterCategoryResponse {
  platform: string;
  categoryId: number;
  categoryName: string;
}

export interface MasterCategoryRequest {
  platform: string;
  categoryId: number;
}

// Coverage matrix (accounts × listings)
export interface MatrixCell {
  productListingId: number;
  // Display name (노출상품명) = ProductListing.name, channel-scoped, always present (35).
  name: string;
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
