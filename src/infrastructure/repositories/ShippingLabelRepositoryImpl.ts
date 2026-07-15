'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type { ShipmentConfirmResult } from '@/application/dto/ShippingLabelDTOs';

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

  // Unlike the download, this returns the standard JSON envelope — unwrap `response.data.data`.
  // `Content-Type: undefined` lets the browser set the multipart boundary.
  async confirmShipment(file: File): Promise<ShipmentConfirmResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post('/api/admin/shipping-labels/confirm', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }
}
