import type {
  CarrierOption,
  ManualShipmentRequest,
  ManualShipmentResult,
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

export interface ShippingLabelRepository {
  confirmShipment(file: File): Promise<ShipmentConfirmResult>;
  previewRows(sellerId?: number): Promise<ShippingLabelPreviewRow[]>;
  previewRowsByOrder(orderItemId: number): Promise<ShippingLabelPreviewRow[]>;
  exportSpreadsheet(rows: ShippingLabelExportRow[]): Promise<Blob>;
  getCarrierOptions(platform: string): Promise<CarrierOption[]>;
  confirmManualShipment(request: ManualShipmentRequest): Promise<ManualShipmentResult>;
}
