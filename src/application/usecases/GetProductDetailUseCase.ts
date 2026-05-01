import type { ProductRepository } from '@/domain/repositories/ProductRepository';
import type { Product } from '@/domain/entities/Product';

export class GetProductDetailUseCase {
  constructor(private repository: ProductRepository) {}

  async getProduct(id: number): Promise<Product> {
    return this.repository.getProductDetail(id);
  }
}
