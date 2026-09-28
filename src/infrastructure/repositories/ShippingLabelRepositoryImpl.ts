'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type {
  CarrierOption,
  InternalLabelPreview,
  ManualShipmentRequest,
  ManualShipmentResult,
  ReservationCreateResult,
  ReservedShipmentRow,
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
  StoredInvoice,
} from '@/application/dto/ShippingLabelDTOs';
import type { InternalStageResult } from '@/application/dto/OrderDTOs';

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

  // 「내부 상품준비중」 접수시트(D26) — 표준 JSON 봉투. 엑셀은 기존 exportSpreadsheet 를 그대로 쓴다.
  async previewInternalRows(sellerId?: number): Promise<InternalLabelPreview> {
    const response = await axiosInstance.get('/api/admin/shipping-labels/v2/preview/internal', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }

  // [예약 발송] — confirmShipment 와 같은 multipart. executeAt 은 KST 'yyyy-MM-ddTHH:mm:ss'(D4).
  async reserveShipment(file: File, executeAt: string): Promise<ReservationCreateResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('executeAt', executeAt);
    const response = await axiosInstance.post('/api/admin/reserved-shipments', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  // 예약 발송 현황 — 주문(결과 행) 단위(D30). 행 작업(시각 변경·다시 시도)의 경로 변수는 결과 행 id(`row.id`)다.
  async getReservedShipments(): Promise<ReservedShipmentRow[]> {
    const response = await axiosInstance.get('/api/admin/reserved-shipments');
    return response.data.data;
  }

  async getReservedShipmentsByOrder(externalOrderId: string): Promise<ReservedShipmentRow[]> {
    const response = await axiosInstance.get(
      `/api/admin/reserved-shipments/orders/${encodeURIComponent(externalOrderId)}`
    );
    return response.data.data;
  }

  async cancelReservedItems(orderItemIds: number[]): Promise<InternalStageResult> {
    const response = await axiosInstance.post('/api/admin/reserved-shipments/items/cancel', { orderItemIds });
    return response.data.data;
  }

  async changeReservationTime(itemId: number, executeAt: string): Promise<ReservedShipmentRow> {
    const response = await axiosInstance.patch(`/api/admin/reserved-shipments/items/${itemId}/execute-at`, {
      executeAt,
    });
    return response.data.data;
  }

  // 서버가 그 자리에서 실행한다(쿠팡 호출). 타임아웃을 줄이지 말 것.
  async retryReservation(itemId: number): Promise<ReservedShipmentRow> {
    const response = await axiosInstance.post(`/api/admin/reserved-shipments/items/${itemId}/retry`);
    return response.data.data;
  }

  // 송장은 배송 묶음 단위(D18) — 내부 단계 묶음별 현재 송장. 경로 변수는 주문번호, 수정은 배송 묶음 id.
  async getStoredInvoices(externalOrderId: string): Promise<StoredInvoice[]> {
    const response = await axiosInstance.get(
      `/api/admin/reserved-shipments/orders/${encodeURIComponent(externalOrderId)}/invoices`
    );
    return response.data.data;
  }

  async changeReservedInvoice(
    orderShipmentId: number,
    deliveryCompanyCode: string,
    invoiceNumber: string
  ): Promise<StoredInvoice> {
    const response = await axiosInstance.put(`/api/admin/reserved-shipments/shipments/${orderShipmentId}/invoice`, {
      deliveryCompanyCode,
      invoiceNumber,
    });
    return response.data.data;
  }

  // 저장된 송장으로 [예약 발송](D18) — 파일 없음. executeAt 은 KST 'yyyy-MM-ddTHH:mm:ss'(D4).
  async reserveStored(orderItemIds: number[], executeAt: string): Promise<ReservationCreateResult> {
    const response = await axiosInstance.post('/api/admin/reserved-shipments/stored', { orderItemIds, executeAt });
    return response.data.data;
  }

  // 저장된 송장으로 [지금 발송](D18) — 서버가 쿠팡 발주처리 → 송장 등록을 한다. 응답은 파일 [지금 발송]과 같은 모양.
  async shipStoredNow(orderItemIds: number[]): Promise<ShipmentConfirmResult> {
    const response = await axiosInstance.post('/api/admin/reserved-shipments/stored/ship-now', { orderItemIds });
    return response.data.data;
  }
}
