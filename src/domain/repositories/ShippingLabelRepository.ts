export interface ShippingLabelRepository {
  downloadSpreadsheet(sellerId?: number): Promise<Blob>;
}
