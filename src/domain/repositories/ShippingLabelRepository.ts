import type {
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

export interface ShippingLabelRepository {
  downloadSpreadsheet(sellerId?: number): Promise<Blob>;
  confirmShipment(file: File): Promise<ShipmentConfirmResult>;
  previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]>;
  previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]>;
  exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob>;
}
