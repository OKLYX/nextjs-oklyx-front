import type { ShipmentConfirmResult } from '@/application/dto/ShippingLabelDTOs';

export interface ShippingLabelRepository {
  downloadSpreadsheet(sellerId?: number): Promise<Blob>;
  confirmShipment(file: File): Promise<ShipmentConfirmResult>;
}
