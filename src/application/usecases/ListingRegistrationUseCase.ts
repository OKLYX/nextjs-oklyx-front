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
  PropagateResponse,
  PendingSyncResponse,
  PushSyncRequest,
  PushSyncResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import type {
  DetailPreviewResponse,
  DetailHtmlOverrideRequest,
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

  updateFieldValues(listingId: number, data: FieldValuesUpdateRequest): Promise<GeneratedProductResponse> {
    return this.repository.updateFieldValues(listingId, data);
  }

  propagate(masterId: number): Promise<PropagateResponse> {
    return this.repository.propagate(masterId);
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
}
