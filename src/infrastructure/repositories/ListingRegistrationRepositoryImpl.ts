'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
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

const masterBase = '/api/admin/master-products';
const listingBase = '/api/admin/product-listings';
const listingsBase = '/api/admin/listings';

export class ListingRegistrationRepositoryImpl implements ListingRegistrationRepository {
  async addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse> {
    const response = await axiosInstance.post(`${masterBase}/${masterId}/listings`, data);
    return response.data.data;
  }

  async addChannelsBatch(
    masterId: number,
    data: BatchChannelAddRequest,
  ): Promise<BatchChannelAddResponse> {
    const response = await axiosInstance.post(`${masterBase}/${masterId}/listings/batch`, data);
    return response.data.data;
  }

  async register(listingId: number): Promise<ListingRegisterResponse> {
    const response = await axiosInstance.post(`${listingBase}/${listingId}/register`);
    return response.data.data;
  }

  async fetchStatus(listingId: number): Promise<ListingStatusResponse> {
    const response = await axiosInstance.post(`${listingBase}/${listingId}/fetch-status`);
    return response.data.data;
  }

  async syncApprovals(): Promise<ListingSyncResponse> {
    const response = await axiosInstance.post(`${listingsBase}/sync-approvals`);
    return response.data.data;
  }

  async getGenerated(listingId: number): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.get(`${listingBase}/${listingId}/generated`);
    return response.data.data;
  }

  async regenerate(listingId: number): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.post(`${listingBase}/${listingId}/regenerate`);
    return response.data.data;
  }

  async overrideThumbnail(listingId: number, file: File): Promise<GeneratedProductResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`${listingBase}/${listingId}/thumbnail`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async clearThumbnail(listingId: number): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.delete(`${listingBase}/${listingId}/thumbnail`);
    return response.data.data;
  }

  async updateFieldValues(
    listingId: number,
    data: FieldValuesUpdateRequest,
  ): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.patch(`${listingBase}/${listingId}/field-values`, data);
    return response.data.data;
  }

  async updateDisplayName(listingId: number, data: DisplayNameUpdateRequest): Promise<void> {
    await axiosInstance.patch(`${listingBase}/${listingId}/name`, data);
  }

  async updateTags(listingId: number, data: TagsUpdateRequest): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.patch(`${listingBase}/${listingId}/tags`, data);
    return response.data.data;
  }

  async updateShippingOverride(
    listingId: number,
    data: ShippingOverrideUpdateRequest,
  ): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.patch(`${listingBase}/${listingId}/shipping-override`, data);
    return response.data.data;
  }

  async getInheritedShipping(listingId: number): Promise<ShippingConfig> {
    const response = await axiosInstance.get(`${listingBase}/${listingId}/shipping-inherited`);
    return response.data.data;
  }

  async propagate(masterId: number): Promise<PropagateResponse> {
    const response = await axiosInstance.post(`${masterBase}/${masterId}/propagate`);
    return response.data.data;
  }

  async getChannelSyncPreview(masterId: number): Promise<ChannelSyncPreview> {
    const response = await axiosInstance.get(`${masterBase}/${masterId}/channel-sync-preview`);
    return response.data.data;
  }

  async pendingSync(): Promise<PendingSyncResponse[]> {
    const response = await axiosInstance.get(`${listingsBase}/pending-sync`);
    return response.data.data;
  }

  async pushSync(data: PushSyncRequest): Promise<PushSyncResponse> {
    const response = await axiosInstance.post(`${listingsBase}/push-sync`, data);
    return response.data.data;
  }

  async previewDetail(listingId: number): Promise<DetailPreviewResponse> {
    const response = await axiosInstance.get(`${listingBase}/${listingId}/detail-preview`);
    return response.data.data;
  }

  async overrideDetailHtml(
    listingId: number,
    data: DetailHtmlOverrideRequest,
  ): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.put(`${listingBase}/${listingId}/detail-html`, data);
    return response.data.data;
  }

  async clearDetailHtml(listingId: number): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.delete(`${listingBase}/${listingId}/detail-html`);
    return response.data.data;
  }

  async getResolvedDetailTemplate(listingId: number): Promise<DetailTemplateResponse> {
    const response = await axiosInstance.get(`${listingBase}/${listingId}/detail-template`);
    return response.data.data;
  }

  async getListingOptions(listingId: number): Promise<ListingOptionsResponse> {
    const response = await axiosInstance.get(`${listingBase}/${listingId}/options`);
    return response.data.data;
  }

  async setActiveOptions(
    listingId: number,
    data: ActiveOptionsRequest,
  ): Promise<ListingOptionsResponse> {
    const response = await axiosInstance.put(`${listingBase}/${listingId}/options/active`, data);
    return response.data.data;
  }
}
