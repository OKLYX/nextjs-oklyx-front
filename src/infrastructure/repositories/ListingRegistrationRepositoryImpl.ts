'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ListingRegistrationRepository } from '@/domain/repositories/ListingRegistrationRepository';
import type {
  ChannelAddRequest,
  ChannelAddResponse,
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

const masterBase = '/api/admin/master-products';
const listingBase = '/api/admin/product-listings';
const listingsBase = '/api/admin/listings';

export class ListingRegistrationRepositoryImpl implements ListingRegistrationRepository {
  async addChannel(masterId: number, data: ChannelAddRequest): Promise<ChannelAddResponse> {
    const response = await axiosInstance.post(`${masterBase}/${masterId}/listings`, data);
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

  async updateFieldValues(
    listingId: number,
    data: FieldValuesUpdateRequest,
  ): Promise<GeneratedProductResponse> {
    const response = await axiosInstance.patch(`${listingBase}/${listingId}/field-values`, data);
    return response.data.data;
  }

  async propagate(masterId: number): Promise<PropagateResponse> {
    const response = await axiosInstance.post(`${masterBase}/${masterId}/propagate`);
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
}
