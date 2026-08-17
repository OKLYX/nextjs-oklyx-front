// Channel registration / approval-sync / 2-layer propagation domain types.
// SSOT = backend contract (prompt 10/12). All endpoints are /api/admin/** (ADMIN),
// responses unwrapped from ResponseDTO<T> (response.data.data) in the Impl.

export type ListingStatus = 'DRAFT' | 'SUBMITTED' | 'SELLING' | 'REJECTED' | 'SUSPENDED';
export type ApprovalStatus = 'APPROVED' | 'NOT_APPROVED';
export type GeneratedSource = 'AUTO' | 'MANUAL_OVERRIDE';

// Channel add (3b' / 13): category·delivery·box now live on the master, so the
// channel-add payload only carries seller, platform, and the chosen options.
export interface ChannelAddRequest {
  sellerId: number;
  platform: string;
  optionIds: number[];
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
  source: GeneratedSource;
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
