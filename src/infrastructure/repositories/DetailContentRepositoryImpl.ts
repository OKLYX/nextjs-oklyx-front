'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { DetailContentRepository } from '@/domain/repositories/DetailContentRepository';
import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterProductImageResponse,
  MasterImageReorderRequest,
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

  async listImages(masterId: number): Promise<MasterProductImageResponse[]> {
    const response = await axiosInstance.get(`${masterBase}/${masterId}/images`);
    return response.data.data;
  }

  async uploadImage(
    masterId: number,
    file: File,
    zoneId: string,
  ): Promise<MasterProductImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('zoneId', zoneId);
    const response = await axiosInstance.post(`${masterBase}/${masterId}/images`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async reorderImages(
    masterId: number,
    data: MasterImageReorderRequest,
  ): Promise<MasterProductImageResponse[]> {
    const response = await axiosInstance.put(`${masterBase}/${masterId}/images/reorder`, data);
    return response.data.data;
  }

  async deleteImage(masterId: number, imageId: number): Promise<void> {
    await axiosInstance.delete(`${masterBase}/${masterId}/images/${imageId}`);
  }
}
