'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ThumbnailTemplateRepository } from '@/domain/repositories/ThumbnailTemplateRepository';
import type { ThumbnailTemplate, FontAsset } from '@/domain/entities/ThumbnailEntity';
import type { ThumbnailTemplateRequest, ThumbnailPreviewRequest } from '@/application/dto/ThumbnailDTOs';

const TEMPLATE_BASE = '/api/admin/thumbnail-templates';
const FONT_BASE = '/api/admin/fonts';

export class ThumbnailTemplateRepositoryImpl implements ThumbnailTemplateRepository {
  async list(): Promise<ThumbnailTemplate[]> {
    const response = await axiosInstance.get(TEMPLATE_BASE);
    return response.data.data;
  }

  async getById(id: number): Promise<ThumbnailTemplate> {
    const response = await axiosInstance.get(`${TEMPLATE_BASE}/${id}`);
    return response.data.data;
  }

  async create(req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate> {
    const response = await axiosInstance.post(TEMPLATE_BASE, req);
    return response.data.data;
  }

  async update(id: number, req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate> {
    const response = await axiosInstance.patch(`${TEMPLATE_BASE}/${id}`, req);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${TEMPLATE_BASE}/${id}`);
  }

  async preview(req: ThumbnailPreviewRequest): Promise<Blob> {
    // Backend returns raw image/jpeg bytes — do NOT unwrap response.data.data.
    const response = await axiosInstance.post(`${TEMPLATE_BASE}/preview`, req, {
      responseType: 'blob',
    });
    return response.data;
  }

  async listFonts(): Promise<FontAsset[]> {
    const response = await axiosInstance.get(FONT_BASE);
    return response.data.data;
  }

  async uploadFont(file: File): Promise<FontAsset> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(FONT_BASE, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }
}
