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

export interface ShippingLabelRepository {
  confirmShipment(file: File): Promise<ShipmentConfirmResult>;
  previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]>;
  previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]>;
  exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob>;
  getCarrierOptions(platform: string): Promise<CarrierOption[]>;
  confirmManualShipment(request: ManualShipmentRequest): Promise<ManualShipmentResult>;
  previewInternalRows(sellerId?: number): Promise<InternalLabelPreview>;
  reserveShipment(file: File, executeAt: string): Promise<ReservationCreateResult>;
  getReservedShipments(): Promise<ReservedShipmentRow[]>;
  getReservedShipmentsByOrder(externalOrderId: string): Promise<ReservedShipmentRow[]>;
  cancelReservedItems(orderItemIds: number[]): Promise<InternalStageResult>;
  changeReservationTime(itemId: number, executeAt: string): Promise<ReservedShipmentRow>;
  retryReservation(itemId: number): Promise<ReservedShipmentRow>;
  getStoredInvoices(externalOrderId: string): Promise<StoredInvoice[]>;
  changeReservedInvoice(orderShipmentId: number, deliveryCompanyCode: string, invoiceNumber: string): Promise<StoredInvoice>;
  reserveStored(orderItemIds: number[], executeAt: string): Promise<ReservationCreateResult>;
  shipStoredNow(orderItemIds: number[]): Promise<ShipmentConfirmResult>;
}
