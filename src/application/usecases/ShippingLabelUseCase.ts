import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';
import type { ShipmentConfirmResult } from '@/application/dto/ShippingLabelDTOs';

export class ShippingLabelUseCase {
  constructor(private repository: ShippingLabelRepository) {}

  async downloadSpreadsheet(sellerId?: number): Promise<Blob> {
    return this.repository.downloadSpreadsheet(sellerId);
  }

  async confirmShipment(file: File): Promise<ShipmentConfirmResult> {
    return this.repository.confirmShipment(file);
  }
}
