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
  PendingSyncResponse,
  PushSyncRequest,
  PushSyncResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import type { TagsUpdateRequest } from '@/domain/entities/MasterProductEntity';
import type {
  DetailPreviewResponse,
  DetailHtmlOverrideRequest,
  DetailTemplateResponse,
} from '@/domain/entities/DetailTemplateEntity';

export interface ListingRegistrationRepository {
  addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse>;
  addChannelsBatch(masterId: number, data: BatchChannelAddRequest): Promise<BatchChannelAddResponse>;
  register(listingId: number): Promise<ListingRegisterResponse>;
  fetchStatus(listingId: number): Promise<ListingStatusResponse>;
  syncApprovals(): Promise<ListingSyncResponse>;
  getGenerated(listingId: number): Promise<GeneratedProductResponse>;
  regenerate(listingId: number): Promise<GeneratedProductResponse>;
  overrideThumbnail(listingId: number, file: File): Promise<GeneratedProductResponse>;
  clearThumbnail(listingId: number): Promise<GeneratedProductResponse>;
  updateFieldValues(listingId: number, data: FieldValuesUpdateRequest): Promise<GeneratedProductResponse>;
  // Display name (35): internal-only PATCH, backend returns no body -> void.
  updateDisplayName(listingId: number, data: DisplayNameUpdateRequest): Promise<void>;
  updateTags(listingId: number, data: TagsUpdateRequest): Promise<GeneratedProductResponse>;
  propagate(masterId: number): Promise<PropagateResponse>;
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
}
