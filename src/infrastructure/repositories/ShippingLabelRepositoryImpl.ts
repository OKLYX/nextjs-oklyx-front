'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';

export class ShippingLabelRepositoryImpl implements ShippingLabelRepository {
  // xlsx is binary — must use responseType 'blob' and return response.data
  // without the usual `response.data.data` JSON unwrapping.
  async downloadSpreadsheet(sellerId?: number): Promise<Blob> {
    const response = await axiosInstance.get('/api/admin/shipping-labels/spreadsheet', {
      params: sellerId != null ? { sellerId } : undefined,
      responseType: 'blob',
    });
    return response.data;
  }
}
