'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { DetailContentRepository } from '@/domain/repositories/DetailContentRepository';
import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterPoolImage,
} from '@/domain/entities/DetailTemplateEntity';

const templatesBase = '/api/admin/detail-templates';
const masterBase = '/api/admin/master-products';

export class DetailContentRepositoryImpl implements DetailContentRepository {
  async listTemplates(): Promise<DetailTemplateResponse[]> {
    const response = await axiosInstance.get(templatesBase);
    return response.data.data;
  }

  async getTemplate(id: number): Promise<DetailTemplateResponse> {
    const response = await axiosInstance.get(`${templatesBase}/${id}`);
    return response.data.data;
  }

  async createTemplate(data: DetailTemplateRequest): Promise<DetailTemplateResponse> {
    const response = await axiosInstance.post(templatesBase, data);
    return response.data.data;
  }

  async updateTemplate(id: number, data: DetailTemplateRequest): Promise<DetailTemplateResponse> {
    const response = await axiosInstance.patch(`${templatesBase}/${id}`, data);
    return response.data.data;
  }

  async deleteTemplate(id: number): Promise<void> {
    await axiosInstance.delete(`${templatesBase}/${id}`);
  }

  async uploadPoolImage(masterId: number, file: File): Promise<MasterPoolImage> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`${masterBase}/${masterId}/images`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async listPoolImages(masterId: number): Promise<MasterPoolImage[]> {
    const response = await axiosInstance.get(`${masterBase}/${masterId}/images`);
    return response.data.data;
  }

  async deletePoolImage(masterId: number, imageId: number): Promise<void> {
    await axiosInstance.delete(`${masterBase}/${masterId}/images/${imageId}`);
  }

  async setZoneImages(
    masterId: number,
    zoneId: string,
    imageIds: number[],
  ): Promise<MasterPoolImage[]> {
    const response = await axiosInstance.put(`${masterBase}/${masterId}/zones/${zoneId}/images`, {
      imageIds,
    });
    return response.data.data;
  }

  async setSourceImage(masterId: number, imageId: number | null): Promise<MasterPoolImage | void> {
    // imageId != null → 200 with the set cover image; null → 204 (cleared).
    const response = await axiosInstance.put(`${masterBase}/${masterId}/source-image`, { imageId });
    return response.data?.data;
  }
}
