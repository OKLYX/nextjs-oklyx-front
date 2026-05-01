import type { ProductRepository, UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import type { Product } from '@/domain/entities/Product';

export class UpdateProductUseCase {
  constructor(private repository: ProductRepository) {}

  async updateProduct(id: number, data: UpdateProductRequest): Promise<Product> {
    return this.repository.updateProduct(id, data);
  }

  async uploadImage(id: number, file: File): Promise<Product> {
    return this.repository.uploadProductImage(id, file);
  }

  async deleteImage(id: number): Promise<void> {
    return this.repository.deleteProductImage(id);
  }

  async checkBarcodeExists(barcodeId: string): Promise<boolean> {
    return this.repository.checkBarcodeExists(barcodeId);
  }
}
