import type { ShippingLabelRepository } from '@/domain/repositories/ShippingLabelRepository';

export class ShippingLabelUseCase {
  constructor(private repository: ShippingLabelRepository) {}

  async downloadSpreadsheet(sellerId?: number): Promise<Blob> {
    return this.repository.downloadSpreadsheet(sellerId);
  }
}
