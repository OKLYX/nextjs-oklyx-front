'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CollageRepository } from '@/domain/repositories/CollageRepository';
import type {
  CollageOverview,
  CollagePreviewRequest,
  CollageSaveRequest,
  CollageStageKey,
  CollageStageResponse,
} from '@/domain/entities/CollageEntity';

const base = (masterId: number) => `/api/admin/master-products/${masterId}/collage`;

export class CollageRepositoryImpl implements CollageRepository {
  async overview(masterId: number): Promise<CollageOverview> {
    const response = await axiosInstance.get(base(masterId));
    return response.data.data;
  }

  async getStage(masterId: number, key: CollageStageKey): Promise<CollageStageResponse> {
    const response = await axiosInstance.get(`${base(masterId)}/stage`, { params: key });
    return response.data.data;
  }

  async save(masterId: number, key: CollageStageKey, data: CollageSaveRequest): Promise<CollageStageResponse> {
    const response = await axiosInstance.put(`${base(masterId)}/stage`, data, { params: key });
    return response.data.data;
  }

  async remove(masterId: number, key: CollageStageKey): Promise<CollageStageResponse> {
    const response = await axiosInstance.delete(`${base(masterId)}/stage`, { params: key });
    return response.data.data;
  }

  async preview(masterId: number, data: CollagePreviewRequest): Promise<Blob> {
    // Backend returns raw image/jpeg bytes — do NOT unwrap response.data.data.
    const response = await axiosInstance.post(`${base(masterId)}/preview`, data, { responseType: 'blob' });
    return response.data;
  }
}
