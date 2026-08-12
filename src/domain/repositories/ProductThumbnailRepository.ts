import type { ProductThumbnail } from '@/domain/entities/ThumbnailEntity';

export interface ProductThumbnailRepository {
  listByProduct(productId: number): Promise<ProductThumbnail[]>;
  generate(productId: number, sellerId: number): Promise<ProductThumbnail>;
  override(productId: number, sellerId: number, file: File): Promise<ProductThumbnail>;
  remove(productId: number, sellerId: number): Promise<void>;
}
