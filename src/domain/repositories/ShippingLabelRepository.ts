import type {
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

export interface ShippingLabelRepository {
  confirmShipment(file: File): Promise<ShipmentConfirmResult>;
  previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]>;
  previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]>;
  exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob>;
}
