// Channel registration / approval-sync / 2-layer propagation domain types.
// SSOT = backend contract (prompt 10/12). All endpoints are /api/admin/** (ADMIN),
// responses unwrapped from ResponseDTO<T> (response.data.data) in the Impl.

export type ListingStatus = 'DRAFT' | 'SUBMITTED' | 'SELLING' | 'REJECTED' | 'SUSPENDED';
export type ApprovalStatus = 'APPROVED' | 'NOT_APPROVED';
export type GeneratedSource = 'AUTO' | 'MANUAL_OVERRIDE';

// Channel add (15): category·delivery·box live on the master and every option is
// copied, so the channel-add payload only identifies the target channel.
export interface ChannelAddRequest {
  sellerId: number;
  platform: string;
}

// Batch channel add (15): register many unregistered channels at once. Partial
// success is normal — `results` reports per-target outcome.
export interface BatchChannelAddRequest {
  targets: { sellerId: number; platform: string }[];
}

export interface BatchChannelAddResult {
  sellerId: number;
  platform: string;
  success: boolean;
  productListingId?: number;
  errorMessage?: string;
}

export interface BatchChannelAddResponse {
  requested: number;
  succeeded: number;
  failed: number;
  results: BatchChannelAddResult[];
}

export interface OptionPrice {
  optionId: number;
  // Channel option display name (matches the master option name). Prefer this over resolving
  // optionId against master options — the ids are in different spaces. Legacy responses omit it.
  optionName?: string | null;
  sellingPrice: number;
  // Per-channel active flag (42/43): only active options are pushed to the market.
  // Toggled inline in the matrix price column; undefined (legacy) is treated as active.
  active?: boolean;
  // Backend-computed (87): the option physically exists on the market, so it can't be removed
  // (approved marketplace options can't be deleted). undefined (legacy) = not on the market.
  onMarket?: boolean;
  // 102: per-channel stock override; null = inherit the master option's stock.
  stockQuantity: number | null;
  // 102/D5: upper bound for this option's channel stock = master stock ?? 9999; also the
  // effective value while stockQuantity is null. Backend is the SSOT — never recompute it.
  maxStock: number;
  // 2609_19/D1: 'AUTO' = 자동계산가, 'MANUAL_OVERRIDE' = 이 채널만 사용자가 정한 값.
  // 레거시 응답은 undefined → AUTO 로 취급한다.
  priceSource?: 'AUTO' | 'MANUAL_OVERRIDE';
  // 2609_22/D3: 'MANUAL_OVERRIDE' = 이 채널에서 정한 옵션명. 레거시 응답 undefined → AUTO 취급.
  optionNameSource?: 'AUTO' | 'MANUAL_OVERRIDE';
  // 2609_22/D2: 마스터에 대응 옵션이 없는 채널 전용 옵션.
  channelOnly?: boolean;
}

// Auto-generated (or overridden) product assets for one channel/listing.
export interface GeneratedProductResponse {
  productListingId: number;
  thumbnailUrl: string | null;
  detailHtml: string | null;
  // Detail-HTML override state (detail badge). Distinct from thumbnailSource below.
  source: GeneratedSource;
  // Thumbnail override state (thumbnail badge, prompt 25/26). Kept separate from
  // `source` — never conflate the two.
  thumbnailSource: GeneratedSource;
  // Per-channel field-value override (prompt 12). Empty {} -> reserved keys render
  // from the product value, custom keys from the template defaultValue.
  fieldValues: Record<string, string>;
  // Channel raw tags (prompt 33). Filled by the same mapper on GET and PATCH; may be
  // null when the cell is ungenerated, so treat as [] in the UI.
  tags: string[];
  optionPrices: OptionPrice[];
  // Channel (listing) shipping override (75). Backend key→string map; null = none.
  shippingOverride?: Record<string, string> | null;
  // Backend-resolved shipping readiness (77) — SSOT for the [마켓 등록] guard.
  // false = 배송 설정 미완료(등록 차단). null/undefined = 미지원 플랫폼·레거시 응답 → 가드 안 함.
  // ⚠️ 프론트에서 재계산하지 말 것.
  shippingReady?: boolean | null;
  // 이 셀에 지정된 상세 템플릿 id(2609_20/D12). null|undefined = 계정/테넌트 기본 상속.
  detailTemplateId?: number | null;
}

export interface ChannelAddResponse {
  productListingId: number;
  status: ListingStatus;
  generated: GeneratedProductResponse;
  // 2609_22/D15: 커밋은 쿠팡을 재조회하므로 미리보기에 없던 경고가 여기서 처음 올 수 있다.
  // 버리지 말고 가져오기 성공 배너로 그대로 띄운다(채널 추가 응답에는 없음 → undefined).
  categoryWarning?: string | null;
}

// Register (push, 3c)
export interface ListingRegisterResponse {
  productListingId: number;
  status: ListingStatus;
  platformProductId: string | null;
}

// Approval refresh (fetch-status)
export interface ListingStatusOption {
  optionId: number;
  approvalStatus: ApprovalStatus;
  platformOptionId: string | null;
}

export interface ListingStatusResponse {
  productListingId: number;
  status: ListingStatus;
  options: ListingStatusOption[];
}

// Batch summaries
export interface ListingSyncResponse {
  swept: number;
  promotedToSelling: number;
  stillPending: number;
  failed: number;
}

export interface PropagateResponse {
  propagated: number;
  skipped: number;
  failed: number;
}

/**
 * Master ↔ channel difference preview (89, GET /api/admin/master-products/{id}/channel-sync-preview).
 * Read-only: it answers "what would [채널에 반영하기] change?" before the button is pressed.
 *
 * ⚠️ `marketChannelOnlyOptions` is NOT counted in `totals` / `inSync` — a propagation run leaves those
 * options alone (the operator must stop them on the marketplace), so counting them would keep the
 * banner up forever. Never use it for the badge count or the disabled check.
 */
export interface ChannelSyncPreview {
  inSync: boolean;
  totals: ChannelSyncTotals;
  channels: ChannelSyncChannel[];
}

/** Option-count sums across all channels — except `affectedChannels`, which counts cells. */
export interface ChannelSyncTotals {
  affectedChannels: number;
  missingOptions: number;
  channelOnlyOptions: number;
  quantityMismatch: number;
}

export interface ChannelSyncChannel {
  listingId: number;
  sellerName: string;
  platform: string;
  /** Already on the marketplace → needs a re-register after the change is applied. */
  onMarket: boolean;
  missingOptions: string[];
  channelOnlyOptions: string[];
  /** Informational only (see ChannelSyncPreview) — excluded from totals/inSync. */
  marketChannelOnlyOptions: string[];
  quantityMismatchOptions: string[];
}

// Pending market-sync (dirty) rows
export interface PendingSyncResponse {
  productListingId: number;
  masterProductName: string;
  seller: string;
  platform: string;
  status: ListingStatus;
}

export interface PushSyncRequest {
  listingIds: number[];
}

export interface PushSyncResponse {
  requested: number;
  pushed: number;
  skipped: number;
  failed: number;
}

// Field-value override save (prompt 12)
export interface FieldValuesUpdateRequest {
  fieldValues: Record<string, string>;
}

// Display-name (노출상품명) save (prompt 35). Backend responds ResponseDTO<Void>
// (no body) — 저장은 로컬만; 마켓 반영은 [수정 요청](109) 필요. Caller refetches the matrix.
export interface DisplayNameUpdateRequest {
  name: string;
}

// Per-channel option activation (prompt 42/43). A channel cell copies the master's
// full option set; each option is toggled active/inactive per channel, and only the
// active subset is pushed to the market on register/regenerate.
export interface ListingOptionSummary {
  optionId: number;
  optionName: string;
  sellingPrice: number;
  active: boolean;
  approvalStatus: ApprovalStatus; // DRAFT (unpushed) cells come back NOT_APPROVED.
  // 102: per-channel stock override; null = inherit the master option's stock.
  stockQuantity: number | null;
  // 102/D5: upper bound (master stock ?? 9999); also the inherited value. Backend SSOT.
  maxStock: number;
  // 2609_19/D1: 'AUTO' = 자동계산가, 'MANUAL_OVERRIDE' = 이 채널만 사용자가 정한 값.
  // 레거시 응답은 undefined → AUTO 로 취급한다.
  priceSource?: 'AUTO' | 'MANUAL_OVERRIDE';
  // 2609_22/D3: 'MANUAL_OVERRIDE' = 이 채널에서 정한 옵션명. 레거시 응답 undefined → AUTO 취급.
  optionNameSource?: 'AUTO' | 'MANUAL_OVERRIDE';
  // 2609_22/D2: 마스터에 대응 옵션이 없는 채널 전용 옵션.
  channelOnly?: boolean;
}

export interface ListingOptionsResponse {
  productListingId: number;
  status: ListingStatus;
  options: ListingOptionSummary[];
  // PUT response only: true when the active set changed on an already-pushed cell
  // (SUBMITTED/SELLING) -> a re-register is needed to reflect it on the market.
  needsResync?: boolean;
  // PUT response only (67/68): registration name recomputed from the new active option
  // set. Used to patch just this cell's registrationName without a full matrix reload.
  registrationName?: string;
}

export interface ActiveOptionsRequest {
  activeOptionIds: number[];
}

// Per-channel option stock (102). Partial update, NOT a whole-set replace: only the
// listed options are touched. stockQuantity null = clear the override (inherit master).
export interface OptionStocksRequest {
  stocks: { optionId: number; stockQuantity: number | null }[];
}

// 채널 옵션 판매가 부분 갱신(2609_19). sellingPrice null = 자동계산가로 복귀(D3).
export interface OptionPricesRequest {
  prices: { optionId: number; sellingPrice: number | null }[];
}

// 저장 + 마켓 반영 결과(D5·D6). 부분 성공이 정상 경로다.
// ⚠️ 저장 후 옵션 목록은 `listing` 안에 있다(`options` 가 아니다 — 백엔드 D14).
export interface ChannelPriceUpdateResponse {
  listing: ListingOptionsResponse;
  pushed: number; // 마켓에 실제 반영된 옵션 수
  skipped: string[]; // 마켓 식별자 없음(미승인/DRAFT) — 로컬만 저장된 옵션명
  failed: { optionName: string; message: string }[]; // 마켓 실패 → 저장되지 않은 옵션
}

// ── 쿠팡 상품 가져오기 (2609_22) ─────────────────────────────────────────────
// 이미 마켓에 올라가 있는 상품을 마스터의 채널 셀로 편입한다. 읽기 전용 편입이라
// 가져오기 자체는 마켓에 아무것도 쓰지 않는다.

// 2609_22: 미리보기 요청. 판매자·플랫폼은 행에서 받는다(모달에 선택 UI 없음).
export interface ImportPreviewRequest {
  sellerId: number;
  platform: string;
  platformProductId: string;
}

// 2609_22: 가져오기 미리보기(쓰기 없음). components = 수량을 채워야 하는 마스터 구성품 줄(D9).
export interface ImportPreviewResponse {
  productName: string;
  status: string;
  categoryCode: string;
  categoryMatched: boolean;
  categoryWarning: string | null; // D15 문구. 그대로 출력한다(가공 금지)
  channelTags: string[];
  components: { productId: number; brand?: string; productName: string }[];
  options: {
    itemName: string;
    vendorItemId: string | null;
    sellerProductItemId: string | null;
    salePrice: number;
    stockQuantity: number | null;
  }[];
}

export interface ImportOptionSpec {
  vendorItemId: string | null; // 미승인 옵션은 null → 서버가 itemName 으로 매칭
  itemName: string;
  masterOptionName: string; // 기본값 = itemName (D11)
  components: { productId: number; quantity: number }[];
}

// 커밋. 가격·재고·옵션 id 는 보내지 않는다 — 서버가 쿠팡 재조회로 확정한다.
export interface ImportRequest extends ImportPreviewRequest {
  options: ImportOptionSpec[];
}

// 채널 옵션명 부분 갱신(2609_22/D3). optionName null = 마스터 옵션명으로 복귀(AUTO).
// 부분 저장이다(재고·판매가와 같은 규칙): 목록에 없는 옵션은 손대지 않는다.
export interface OptionNamesRequest {
  names: { optionId: number; optionName: string | null }[];
}

// [옵션명 일괄 적용] 결과(2609_22/D4).
// ⚠️ `warnings` = 이름 중복으로 통째로 건너뛴 셀의 **사람이 읽는 문장**이다
// (`옵션명 중복으로 건너뜀: listingId=12`). 셀 id 배열이 아니므로 파싱하지 말고 그대로 나열한다.
// 구버전 응답 대비 화면에서는 `?? []` 로 읽는다.
export interface ApplyOptionNamesResponse {
  updatedCells: number;
  updatedOptions: number;
  warnings: string[];
}
