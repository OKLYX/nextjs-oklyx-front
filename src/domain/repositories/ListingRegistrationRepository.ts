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

export interface ListingRegistrationRepository {
  addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse>;
  addChannelsBatch(masterId: number, data: BatchChannelAddRequest): Promise<BatchChannelAddResponse>;
  register(listingId: number): Promise<ListingRegisterResponse>;
  fetchStatus(listingId: number): Promise<ListingStatusResponse>;
  syncApprovals(): Promise<ListingSyncResponse>;
  getGenerated(listingId: number): Promise<GeneratedProductResponse>;
  regenerate(listingId: number): Promise<GeneratedProductResponse>;
  updateFieldValues(listingId: number, data: FieldValuesUpdateRequest): Promise<GeneratedProductResponse>;
  propagate(masterId: number): Promise<PropagateResponse>;
  pendingSync(): Promise<PendingSyncResponse[]>;
  pushSync(data: PushSyncRequest): Promise<PushSyncResponse>;
}
