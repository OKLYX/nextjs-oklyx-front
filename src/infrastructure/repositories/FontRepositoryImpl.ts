'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { FontRepository } from '@/domain/repositories/FontRepository';
import type { FontAsset } from '@/domain/entities/FontEntity';

const FONT_BASE = '/api/admin/fonts';

export class FontRepositoryImpl implements FontRepository {
  async list(): Promise<FontAsset[]> {
    const response = await axiosInstance.get(FONT_BASE);
    return response.data.data;
  }

  async upload(file: File): Promise<FontAsset> {
    const formData = new FormData();
    formData.append('file', file);
    // Content-Type undefined = let the browser set the multipart boundary.
    const response = await axiosInstance.post(FONT_BASE, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }
}
