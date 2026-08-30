import type { ListingRegistrationRepository } from '@/domain/repositories/ListingRegistrationRepository';
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

export class ListingRegistrationUseCase {
  constructor(private repository: ListingRegistrationRepository) {}

  addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse> {
    return this.repository.addChannel(masterId, data);
  }

  addChannelsBatch(masterId: number, data: BatchChannelAddRequest): Promise<BatchChannelAddResponse> {
    return this.repository.addChannelsBatch(masterId, data);
  }

  register(listingId: number): Promise<ListingRegisterResponse> {
    return this.repository.register(listingId);
  }

  fetchStatus(listingId: number): Promise<ListingStatusResponse> {
    return this.repository.fetchStatus(listingId);
  }

  syncApprovals(): Promise<ListingSyncResponse> {
    return this.repository.syncApprovals();
  }

  getGenerated(listingId: number): Promise<GeneratedProductResponse> {
    return this.repository.getGenerated(listingId);
  }

  regenerate(listingId: number): Promise<GeneratedProductResponse> {
    return this.repository.regenerate(listingId);
  }

  overrideThumbnail(listingId: number, file: File): Promise<GeneratedProductResponse> {
    return this.repository.overrideThumbnail(listingId, file);
  }

  clearThumbnail(listingId: number): Promise<GeneratedProductResponse> {
    return this.repository.clearThumbnail(listingId);
  }

  updateFieldValues(listingId: number, data: FieldValuesUpdateRequest): Promise<GeneratedProductResponse> {
    return this.repository.updateFieldValues(listingId, data);
  }

  updateDisplayName(listingId: number, data: DisplayNameUpdateRequest): Promise<void> {
    return this.repository.updateDisplayName(listingId, data);
  }

  updateTags(listingId: number, data: TagsUpdateRequest): Promise<GeneratedProductResponse> {
    return this.repository.updateTags(listingId, data);
  }

  updateShippingOverride(
    listingId: number,
    data: ShippingOverrideUpdateRequest,
  ): Promise<GeneratedProductResponse> {
    return this.repository.updateShippingOverride(listingId, data);
  }

  getInheritedShipping(listingId: number): Promise<ShippingConfig> {
    return this.repository.getInheritedShipping(listingId);
  }

  propagate(masterId: number): Promise<PropagateResponse> {
    return this.repository.propagate(masterId);
  }

  getChannelSyncPreview(masterId: number): Promise<ChannelSyncPreview> {
    return this.repository.getChannelSyncPreview(masterId);
  }

  pendingSync(): Promise<PendingSyncResponse[]> {
    return this.repository.pendingSync();
  }

  pushSync(data: PushSyncRequest): Promise<PushSyncResponse> {
    return this.repository.pushSync(data);
  }

  previewDetail(listingId: number): Promise<DetailPreviewResponse> {
    return this.repository.previewDetail(listingId);
  }

  overrideDetailHtml(
    listingId: number,
    data: DetailHtmlOverrideRequest,
  ): Promise<GeneratedProductResponse> {
    return this.repository.overrideDetailHtml(listingId, data);
  }

  clearDetailHtml(listingId: number): Promise<GeneratedProductResponse> {
    return this.repository.clearDetailHtml(listingId);
  }

  getResolvedDetailTemplate(listingId: number): Promise<DetailTemplateResponse> {
    return this.repository.getResolvedDetailTemplate(listingId);
  }

  getListingOptions(listingId: number): Promise<ListingOptionsResponse> {
    return this.repository.getListingOptions(listingId);
  }

  setActiveOptions(listingId: number, data: ActiveOptionsRequest): Promise<ListingOptionsResponse> {
    return this.repository.setActiveOptions(listingId, data);
  }
}
