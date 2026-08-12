import type { ProductThumbnailRepository } from '@/domain/repositories/ProductThumbnailRepository';
import type { ProductThumbnail } from '@/domain/entities/ThumbnailEntity';

export class ProductThumbnailUseCase {
  constructor(private repository: ProductThumbnailRepository) {}

  async listByProduct(productId: number): Promise<ProductThumbnail[]> {
    return this.repository.listByProduct(productId);
  }

  async generate(productId: number, sellerId: number): Promise<ProductThumbnail> {
    return this.repository.generate(productId, sellerId);
  }

  async override(productId: number, sellerId: number, file: File): Promise<ProductThumbnail> {
    return this.repository.override(productId, sellerId, file);
  }

  async remove(productId: number, sellerId: number): Promise<void> {
    return this.repository.remove(productId, sellerId);
  }
}
