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

export class ShippingLabelUseCase {
  constructor(private repository: ShippingLabelRepository) {}

  async confirmShipment(file: File): Promise<ShipmentConfirmResult> {
    return this.repository.confirmShipment(file);
  }

  async previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]> {
    return this.repository.previewRows(sellerId);
  }

  async previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]> {
    return this.repository.previewRowsByOrder(orderItemId);
  }

  async exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob> {
    return this.repository.exportSpreadsheet(rows);
  }

  async getCarrierOptions(platform: string): Promise<CarrierOption[]> {
    return this.repository.getCarrierOptions(platform);
  }

  async confirmManualShipment(request: ManualShipmentRequest): Promise<ManualShipmentResult> {
    return this.repository.confirmManualShipment(request);
  }

  async previewInternalRows(sellerId?: number): Promise<InternalLabelPreview> {
    return this.repository.previewInternalRows(sellerId);
  }

  async reserveShipment(file: File, executeAt: string): Promise<ReservationCreateResult> {
    return this.repository.reserveShipment(file, executeAt);
  }

  async getReservedShipments(): Promise<ReservedShipmentRow[]> {
    return this.repository.getReservedShipments();
  }

  async getReservedShipmentsByOrder(externalOrderId: string): Promise<ReservedShipmentRow[]> {
    return this.repository.getReservedShipmentsByOrder(externalOrderId);
  }

  async cancelReservedItems(orderItemIds: number[]): Promise<InternalStageResult> {
    return this.repository.cancelReservedItems(orderItemIds);
  }

  async changeReservationTime(itemId: number, executeAt: string): Promise<ReservedShipmentRow> {
    return this.repository.changeReservationTime(itemId, executeAt);
  }

  async retryReservation(itemId: number): Promise<ReservedShipmentRow> {
    return this.repository.retryReservation(itemId);
  }

  async getStoredInvoices(externalOrderId: string): Promise<StoredInvoice[]> {
    return this.repository.getStoredInvoices(externalOrderId);
  }

  async changeReservedInvoice(
    orderShipmentId: number,
    deliveryCompanyCode: string,
    invoiceNumber: string
  ): Promise<StoredInvoice> {
    return this.repository.changeReservedInvoice(orderShipmentId, deliveryCompanyCode, invoiceNumber);
  }

  async reserveStored(orderItemIds: number[], executeAt: string): Promise<ReservationCreateResult> {
    return this.repository.reserveStored(orderItemIds, executeAt);
  }

  async shipStoredNow(orderItemIds: number[]): Promise<ShipmentConfirmResult> {
    return this.repository.shipStoredNow(orderItemIds);
  }
}
