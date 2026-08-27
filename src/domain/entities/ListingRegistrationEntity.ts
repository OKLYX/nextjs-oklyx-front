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
// (no body) — internal only, no market push; caller refetches the matrix.
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
