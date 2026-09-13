'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PackingRepository } from '@/domain/repositories/PackingRepository';
import type {
  BarcodeLookupResult,
  BoxCandidate,
  BoxCandidateItem,
  PackingCloseResult,
  PackingCompleteResult,
  PackingScanResponse,
  ParcelCompleteRequest,
  PendingParcel,
} from '@/domain/entities/PackingEntity';

/** `/api/admin/packing/...` — 전부 ADMIN 전용이다 */
export class PackingRepositoryImpl implements PackingRepository {
  async scan(invoiceNumber: string): Promise<PackingScanResponse> {
    const response = await axiosInstance.get('/api/admin/packing/scan', {
      params: { invoiceNumber },
    });
    return response.data.data;
  }

  async pending(sellerId?: number): Promise<PendingParcel[]> {
    const response = await axiosInstance.get('/api/admin/packing/pending', {
      params: sellerId ? { sellerId } : undefined,
    });
    return response.data.data;
  }

  async lookupBarcode(value: string, parcelId: number): Promise<BarcodeLookupResult> {
    const response = await axiosInstance.get('/api/admin/packing/barcode', {
      params: { value, parcelId },
    });
    return response.data.data;
  }

  async boxCandidates(items: BoxCandidateItem[]): Promise<BoxCandidate[]> {
    const response = await axiosInstance.post('/api/admin/packing/box-candidates', { items });
    return response.data.data;
  }

  async complete(
    parcelId: number,
    request: ParcelCompleteRequest
  ): Promise<PackingCompleteResult> {
    const response = await axiosInstance.post(
      `/api/admin/packing/parcels/${parcelId}/complete`,
      request
    );
    return response.data.data;
  }

  async markUnused(parcelId: number): Promise<PackingCloseResult> {
    const response = await axiosInstance.post(`/api/admin/packing/parcels/${parcelId}/unused`);
    return response.data.data;
  }
}
