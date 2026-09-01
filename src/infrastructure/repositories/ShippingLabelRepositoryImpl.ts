'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type {
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

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

  // V2 preview returns the standard JSON envelope — unwrap `response.data.data`.
  async previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]> {
    const response = await axiosInstance.get('/api/admin/shipping-labels/v2/preview', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }

  // Single-order preview — same JSON envelope as previewRows, so unwrap `response.data.data`.
  // orderItemId is our order_item PK, not the Coupang orderId.
  async previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]> {
    const response = await axiosInstance.get('/api/admin/shipping-labels/v2/preview/by-order', {
      params: { orderItemId },
    });
    return response.data.data;
  }

  // V2 export posts edited rows and returns the xlsx binary — responseType 'blob', no unwrapping.
  async exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob> {
    const response = await axiosInstance.post(
      '/api/admin/shipping-labels/v2/spreadsheet',
      { rows },
      { responseType: 'blob' }
    );
    return response.data;
  }
}
