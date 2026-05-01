import type { CreateProductRequest, ProductRepository } from '@/domain/repositories/ProductRepository';
import type { Product } from '@/domain/entities/Product';

export class CreateProductUseCase {
  constructor(private repository: ProductRepository) {}

  async createProduct(data: CreateProductRequest): Promise<Product> {
    return this.repository.createProduct(data);
  }

  async uploadImage(id: number, file: File): Promise<Product> {
    return this.repository.uploadProductImage(id, file);
  }

  async checkBarcodeExists(barcodeId: string): Promise<boolean> {
    return this.repository.checkBarcodeExists(barcodeId);
  }
}
