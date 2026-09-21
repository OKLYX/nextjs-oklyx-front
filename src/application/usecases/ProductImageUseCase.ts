import type { ProductImageRepository } from '@/domain/repositories/ProductImageRepository';
import type { ProductImage } from '@/domain/entities/ProductImage';

// Thin delegation over the product gallery repo (backend 39). Create as
// `new ProductImageUseCase(new ProductImageRepositoryImpl())` in a parent
// (useMemo) and inject into ProductImageGallery / MasterImagePool.
export class ProductImageUseCase {
  constructor(private repository: ProductImageRepository) {}

  list(productId: number): Promise<ProductImage[]> {
    return this.repository.list(productId);
  }

  add(productId: number, files: File[]): Promise<ProductImage[]> {
    return this.repository.add(productId, files);
  }

  copy(productId: number, sourceImageIds: number[]): Promise<ProductImage[]> {
    return this.repository.copy(productId, sourceImageIds);
  }

  addFromUrls(productId: number, urls: string[]): Promise<ProductImage[]> {
    return this.repository.addFromUrls(productId, urls);
  }

  replace(productId: number, imageId: number, file: File): Promise<ProductImage> {
    return this.repository.replace(productId, imageId, file);
  }

  reorder(productId: number, imageIds: number[]): Promise<ProductImage[]> {
    return this.repository.reorder(productId, imageIds);
  }

  remove(productId: number, imageId: number): Promise<void> {
    return this.repository.remove(productId, imageId);
  }
}
