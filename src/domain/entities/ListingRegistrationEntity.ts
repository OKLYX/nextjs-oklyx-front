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
  sellingPrice: number;
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
