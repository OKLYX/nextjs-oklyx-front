'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type {
  CarrierOption,
  ManualShipmentRequest,
  ManualShipmentResult,
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

export class ShippingLabelRepositoryImpl implements ShippingLabelRepository {
  // Unlike the xlsx endpoints, this returns the standard JSON envelope — unwrap `response.data.data`.
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

  // Carrier dropdown for the manual single-box path — standard JSON envelope.
  // Returns an empty list (not an error) when the platform has no carrier code registered.
  async getCarrierOptions(platform: string): Promise<CarrierOption[]> {
    const response = await axiosInstance.get('/api/admin/shipping-labels/carrier-options', {
      params: { platform },
    });
    return response.data.data;
  }

  // Manual single-box confirm — standard JSON envelope. The server expands the anchor line into
  // every line of its box (PLAN 2609_11 D1) and picks CREATE/UPDATE from the order status (D3).
  async confirmManualShipment(request: ManualShipmentRequest): Promise<ManualShipmentResult> {
    const response = await axiosInstance.post('/api/admin/shipping-labels/confirm/manual', request);
    return response.data.data;
  }
}
