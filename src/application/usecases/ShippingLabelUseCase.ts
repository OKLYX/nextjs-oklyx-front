import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type {
  ShipmentConfirmResult,
  ShippingLabelPreviewRow,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

export class ShippingLabelUseCase {
  constructor(private repository: ShippingLabelRepository) {}

  async downloadSpreadsheet(sellerId?: number): Promise<Blob> {
    return this.repository.downloadSpreadsheet(sellerId);
  }

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
}
