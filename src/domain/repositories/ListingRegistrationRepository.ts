import type {
  ChannelAddRequest,
  ChannelAddResponse,
  BatchChannelAddRequest,
  BatchChannelAddResponse,
  ListingRegisterResponse,
  ListingStatusResponse,
  ListingSyncResponse,
  GeneratedProductResponse,
  FieldValuesUpdateRequest,
  DisplayNameUpdateRequest,
  PropagateResponse,
  ChannelSyncPreview,
  PendingSyncResponse,
  PushSyncRequest,
  PushSyncResponse,
  ListingOptionsResponse,
  ActiveOptionsRequest,
  OptionStocksRequest,
  OptionPricesRequest,
  ChannelPriceUpdateResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import type {
  TagsUpdateRequest,
  ShippingOverrideUpdateRequest,
} from '@/domain/entities/MasterProductEntity';
import type { ShippingConfig } from '@/domain/entities/ShippingEntity';
import type {
  DetailPreviewResponse,
  DetailHtmlOverrideRequest,
  DetailTemplateResponse,
} from '@/domain/entities/DetailTemplateEntity';

export interface ListingRegistrationRepository {
  addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse>;
  addChannelsBatch(masterId: number, data: BatchChannelAddRequest): Promise<BatchChannelAddResponse>;
  register(listingId: number): Promise<ListingRegisterResponse>;
  // Update request (109): forced re-push of an already-registered cell -> re-review (SUBMITTED).
  updateRequest(listingId: number): Promise<ListingRegisterResponse>;
  fetchStatus(listingId: number): Promise<ListingStatusResponse>;
  syncApprovals(): Promise<ListingSyncResponse>;
  getGenerated(listingId: number): Promise<GeneratedProductResponse>;
  regenerate(listingId: number): Promise<GeneratedProductResponse>;
  overrideThumbnail(listingId: number, file: File): Promise<GeneratedProductResponse>;
  clearThumbnail(listingId: number): Promise<GeneratedProductResponse>;
  updateFieldValues(listingId: number, data: FieldValuesUpdateRequest): Promise<GeneratedProductResponse>;
  // Display name (35): 로컬 저장 PATCH(마켓 반영은 [수정 요청]), backend returns no body -> void.
  updateDisplayName(listingId: number, data: DisplayNameUpdateRequest): Promise<void>;
  updateTags(listingId: number, data: TagsUpdateRequest): Promise<GeneratedProductResponse>;
  // Channel shipping override (75): PATCH replaces this cell's override (no regenerate).
  updateShippingOverride(
    listingId: number,
    data: ShippingOverrideUpdateRequest,
  ): Promise<GeneratedProductResponse>;
  // Inherited shipping baseline (76): master ?? account, own channel override excluded — placeholders.
  getInheritedShipping(listingId: number): Promise<ShippingConfig>;
  propagate(masterId: number): Promise<PropagateResponse>;
  // Channel sync preview (89): what a propagate run would change, read-only.
  getChannelSyncPreview(masterId: number): Promise<ChannelSyncPreview>;
  pendingSync(): Promise<PendingSyncResponse[]>;
  pushSync(data: PushSyncRequest): Promise<PushSyncResponse>;
  // Detail-page (prompt 11): AUTO preview + raw HTML override / clear.
  previewDetail(listingId: number): Promise<DetailPreviewResponse>;
  overrideDetailHtml(
    listingId: number,
    data: DetailHtmlOverrideRequest,
  ): Promise<GeneratedProductResponse>;
  clearDetailHtml(listingId: number): Promise<GeneratedProductResponse>;
  // Detail-page (prompt 30): resolve the template actually applied to this cell
  // (account-assigned ?? tenant default) so upload zones match the generator.
  getResolvedDetailTemplate(listingId: number): Promise<DetailTemplateResponse>;
  // Per-channel option activation (prompt 42/43): read the full option set (with
  // active flags) and save the active subset. Only active options are market-pushed.
  getListingOptions(listingId: number): Promise<ListingOptionsResponse>;
  setActiveOptions(listingId: number, data: ActiveOptionsRequest): Promise<ListingOptionsResponse>;
  // Per-channel option stock (102): partial bulk save of the cell's stock overrides.
  setOptionStocks(listingId: number, data: OptionStocksRequest): Promise<ListingOptionsResponse>;
  /** 채널 옵션 판매가 저장 + 마켓 즉시 반영(2609_19). null = 자동계산가 복귀. */
  setOptionPrices(listingId: number, data: OptionPricesRequest): Promise<ChannelPriceUpdateResponse>;
}
