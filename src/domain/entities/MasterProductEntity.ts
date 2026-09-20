// MasterProduct (판매상품 마스터) domain types — mirror of the backend confirmed fields.
import type { ListingStatus, ListingOptionSummary } from './ListingRegistrationEntity';
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

/**
 * 같은 구성상품 조합으로 이미 만들어진 마스터 (2609_46).
 *
 * 마스터의 정체성은 구성상품 조합이다 — 수량 차이(1개 / 5개 묶음)는 **같은 마스터의 옵션**이지
 * 새 마스터가 아니다. 생성 화면이 "이미 있습니다" 안내와 이동 링크를 만들 수 있을 만큼만 담는다.
 *
 * ⚠️ `active: false`(삭제된 마스터)도 내려온다 — 목록에 안 보여서 또 만드는 것을 막기 위함.
 */
export interface MasterProductByComponents {
  id: number;
  name: string;
  active: boolean;
  optionCount: number;
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

// 2609_64: 구성상품 + 옵션 전체를 한 번에 교체한다. 구성과 옵션 수량 벡터는 서로를 검증하므로
// 따로 저장하면 어느 쪽도 바꿀 수 없다. `PUT /{id}/composition` 전용.
// 🔴 배송·박스 override / categoryAttributes / categoryNotices / stockQuantity 를 여기에 넣지 말 것 —
// 백엔드가 기존 행에서 그대로 이어받는다. 보내면 화면이 모르는 값이 조용히 지워진다.
export interface MasterCompositionOptionSpec {
  optionId?: number; // 생략 = 새 옵션
  name: string;
  items: MasterOptionRequestItem[];
}

export interface MasterCompositionRequest {
  componentProductIds: number[];
  // 저장 후 이 마스터가 가질 옵션 전체. 여기 없는 기존 옵션은 삭제된다.
  options: MasterCompositionOptionSpec[];
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
  // 이 셀이 **실제로** 쓰는 마켓 카테고리 코드/이름(2609_45/D9). 해석 불가면 null.
  categoryCode?: string | null;
  categoryName?: string | null;
  // true = 채널 자기 카테고리, false = 마스터 카테고리.
  // ⚠️ 프론트가 `categoryCode` 유무나 이름 비교로 다시 판정하지 말 것(2609_45/D10-1) — 가져오기는
  // 카테고리가 같아도 코드를 저장하므로 기존 셀 전부에 배지가 뜬다. 판정은 서버 값 하나뿐이다.
  usesOwnCategory?: boolean;
}

export interface MatrixRow {
  sellerId: number;
  sellerName: string;
  platform: string;
  accountId: number;
  accountLabel: string;
  registered: boolean;
  // 🔴 첫 셀만 담는다 — 썸네일·상세페이지·상태·판매가·액션 열이 전부 이 계약 위에 있다(2609_61/D5).
  // 지우지 말 것. 계정에 셀이 둘 이상이어도 여기엔 첫 셀뿐이다.
  cell: MatrixCell | null;
  // 이 계정의 **모든** 셀(백엔드는 이미 보내고 있다). 새로 만드는 열만 이것을 읽는다 —
  // 한 계정이 같은 마스터로 쿠팡 페이지를 여러 개 가질 수 있다(2026-09-19 편입 가드 완화).
  // ⚠️ optional — 예전 응답에는 없으므로 읽는 쪽에서 `cell` 폴백을 둔다.
  cells?: MatrixCell[];
}

export interface ListingMatrixResponse {
  masterId: number;
  masterName: string;
  rows: MatrixRow[];
  // 마스터 표준 카테고리를 플랫폼 코드로 해석한 이름(2609_45/D13). 셀마다 같은 값이라 최상위에 온다.
  // [마스터 카테고리로 변경] 안내의 "A → B" 중 B 쪽. 해석 불가/미배포면 null·없음.
  masterCategoryName?: string | null;
}

// 마스터의 **모든** 채널 셀 + 셀별 옵션 전체(2609_61/D6). 셀마다
// `GET /product-listings/{id}/options` 를 부르는 대신 한 번에 받는다 — 셀이 늘어도 호출은 1번.
// ⚠️ 채널 라벨(판매자·플랫폼·계정)은 이 응답에 없다. 화면은 매트릭스(`getMatrix`)의 행과
// `productListingId` 로 맞춰 라벨을 가져온다 — 라벨을 두 응답에 두면 서로 어긋난다(백엔드 DTO 주석).
export interface MasterChannelOptionsResponse {
  masterId: number;
  cells: MasterChannelOptionCell[];
}

export interface MasterChannelOptionCell {
  productListingId: number;
  // 「상품 ID」(쿠팡 sellerProductId). null = 아직 마켓에 없음(DRAFT) — 오류가 아니다(D2).
  platformProductId: string | null;
  status: ListingStatus;
  // 활성·비활성 옵션 전부. 옵션 DTO 는 셀 옵션 조회와 **같은 타입**을 재사용한다(백엔드 D6).
  options: ListingOptionSummary[];
}

// ── List query (110/111) ─────────────────────────────────────────────────────
// API vocabulary. The URL uses `q`; the conversion happens once in
// `master-products/masterListQuery.ts#toApiParams` — never rename inside the repo/usecase.
export interface MasterProductListParams {
  page: number;
  size: number;
  sort: string; // `field,direction` e.g. createdAt,desc — unknown fields are a 400 on the server
  search?: string; // omitted key = no name filter
}

// Spring `Page<MasterProductResponse>` — only the fields the UI reads.
export interface MasterProductPageResponse {
  content: MasterProductResponse[];
  totalElements: number;
  totalPages: number;
  number: number; // current page index (0-based)
  size: number;
}
