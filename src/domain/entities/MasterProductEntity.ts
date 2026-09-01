// MasterProduct (판매상품 마스터) domain types — mirror of the backend confirmed fields.
import type { ListingStatus } from './ListingRegistrationEntity';
// Backend endpoints are all /api/admin/master-products/** (ADMIN-only).

export interface MasterComponent {
  productId: number;
  productName: string;
  // 물품(Product)의 개당 계량값 — 옵션의 `개당 중량/용량` 도출 소스 (101).
  // Optional: 이 필드를 내려주지 않는 응답/버퍼에서도 타입이 성립해야 한다.
  netContent?: string | null;
  netContentUnit?: string | null; // 저장 단위 코드 G/KG/L/ML (물품 폼의 select value)
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
  // Per-option category attribute/notice overrides (60). Only keys that differ from the
  // master value are stored; a missing/empty key inherits the master value. Nullable.
  categoryAttributes?: Record<string, string> | null;
  categoryNotices?: Record<string, string> | null;
  // 쿠팡에 등록돼 판매 중 = 수량·이름 수정/삭제 불가 (84). Backend flag is the single source of
  // truth — never recompute it on the front. legacy/미지원 응답은 undefined = 잠그지 않음.
  marketRegistered?: boolean;
  // Master default stock (102). null = 미지정 (channels fall back to 9999). 0 = 품절 —
  // never treat this as falsy/absent.
  stockQuantity?: number | null;
  // 102/D5: how many channel overrides the backend clamped down to this option's new stock
  // on the last save. Only ever > 0 on an update response; create always returns 0.
  clampedChannels?: number;
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
  // "옵션확인" 접미사 마스터 override (69). null = 상속(채널 → 판매자 → 시스템).
  optionCheckSuffixEnabled?: boolean | null;
  optionCheckSuffix?: string | null;
  // Master-level shipping override (75; all channels). Backend key→string map;
  // place keys (outbound/return center) are dropped at the master level. null = none.
  shippingOverride?: Record<string, string> | null;
}

// Tags PATCH body, shared by master pool and channel raw endpoints.
export interface TagsUpdateRequest {
  tags: string[];
}

// Shipping-override PATCH body (75), shared by the master and listing endpoints.
// `override` = key→string map; empty map clears the override (inherit).
export interface ShippingOverrideUpdateRequest {
  override: Record<string, string>;
}

// Force-apply body (79): which channels to overwrite with the master's shipping settings.
// Omitted / empty list = every linked channel (backend keeps the bodyless "all channels" behaviour).
export interface ShippingForceApplyRequest {
  listingIds?: number[];
}

// Force-apply result (77/79): how many channels actually changed. 0 = every selected channel already
// matched the master (idempotent no-op, not a failure).
export interface ShippingForceApplyResponse {
  affectedChannels: number;
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
  // Per-option category attribute/notice overrides (60). Send only keys that differ from
  // the master value; an empty map is omitted (undefined = no override, inherit master).
  categoryAttributes?: Record<string, string>;
  categoryNotices?: Record<string, string>;
  // Master default stock (102). 생략 = 미지정으로 지움(null 저장), 0 = 품절.
  // ⚠️ Unlike deliveryId/packageId, omitting this does NOT keep the existing value.
  stockQuantity?: number;
}

// Master standard category (single, backend 44). The per-platform market code is
// resolved from CategoryMapping, not stored here. Repo normalizes the "unset" case
// (backend returns null fields) to a null object.
export interface MasterCategoryResponse {
  categoryId: number;
  categoryName: string;
}

export interface MasterCategoryRequest {
  categoryId: number;
}

// Category required-attributes / product-info notices (backend 47). Schema is
// per (platform × category) and may be empty (empty = skip the input step).
export interface CategoryAttribute {
  name: string;
  required: boolean;
  inputType: 'TEXT' | 'SELECT' | 'NUMBER';
  options: string[]; // SELECT candidates; empty for TEXT/NUMBER
  // Base unit (Coupang basicUnit, backend 94). null/undefined = no unit ("없음" is normalized by backend)
  basicUnit?: string | null;
}

export interface CategoryNotice {
  key: string; // === label (한글 개념어, 쿠팡 noticeCategoryDetailName)
  label: string;
  required: boolean;
  groupName?: string | null; // 쿠팡 noticeCategoryName (품목군); null → "기타" 그룹 (backend 61)
}

export interface CategoryMetaValues {
  attributes: Record<string, string>; // name -> current master value
  notices: Record<string, string>; // key -> current master value
  // 저장된 상품정보제공고시 품목군(groupName). null/필드 없음 = 미지정 → 프론트 폴백으로 해석 (backend 91).
  noticeGroup?: string | null;
}

export interface CategoryMetaResponse {
  attributes: CategoryAttribute[];
  notices: CategoryNotice[];
  values: CategoryMetaValues;
}

// Schema-only lookup (no values) for the create/registration screen, where a master
// does not exist yet. Keyed by (platform × categoryId). Backend 57.
export interface CategoryMetaSchemaResponse {
  attributes: CategoryAttribute[];
  notices: CategoryNotice[];
}

// PATCH body: raw useState maps sent as-is (NUMBER values also travel as strings).
export interface CategoryAttributesRequest {
  attributes: Record<string, string>;
  notices: Record<string, string>;
  // 전송한 notices 가 속한 품목군. optional — 91 미배포 백엔드는 모르는 필드를 무시한다.
  noticeGroup?: string | null;
}

// Coverage matrix (accounts × listings)
export interface MatrixCell {
  productListingId: number;
  // Display name (노출상품명) = ProductListing.name, channel-scoped, always present (35).
  name: string;
  // Registration name (등록상품명) = always auto-computed from the channel's active options (67).
  // Read-only in the UI; refreshed in place when the active option set is toggled (43/68).
  registrationName: string;
  platformProductId: string | null;
  sellingPrice: number | null;
  // 이 셀의 실제 등록 상태(백엔드 enum 이름 그대로). ⚠️ **optional** — 백엔드 미배포 응답에는 없다.
  // 종전엔 이 값이 없어서 프론트가 `platformProductId` 유무로 DRAFT/SUBMITTED 를 **추정**했고,
  // 그래서 승인완료·반려된 셀이 계속 "승인 대기중"으로 보였다.
  status?: ListingStatus;
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
