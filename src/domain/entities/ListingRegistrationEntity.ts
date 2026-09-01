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
}

export interface ChannelAddResponse {
  productListingId: number;
  status: ListingStatus;
  generated: GeneratedProductResponse;
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
 * ⚠️ `marketOrphanOptions` is NOT counted in `totals` / `inSync` — a propagation run leaves those
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
  orphanOptions: number;
  quantityMismatch: number;
}

export interface ChannelSyncChannel {
  listingId: number;
  sellerName: string;
  platform: string;
  /** Already on the marketplace → needs a re-register after the change is applied. */
  onMarket: boolean;
  missingOptions: string[];
  orphanOptions: string[];
  /** Informational only (see ChannelSyncPreview) — excluded from totals/inSync. */
  marketOrphanOptions: string[];
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
