import type { ProductImage } from '@/domain/entities/ProductImage';

// A product's 1:N source image gallery (backend 39). All endpoints are ADMIN
// under /api/admin/products/{productId}/images. Responses are unwrapped from
// ResponseDTO<T> (response.data.data) in the Impl.
export interface ProductImageRepository {
  list(productId: number): Promise<ProductImage[]>;
  // Multipart: append each file as `files`. One POST adds all of them.
  add(productId: number, files: File[]): Promise<ProductImage[]>;
  // Replace one image in place (keeps the same image id).
  replace(productId: number, imageId: number, file: File): Promise<ProductImage>;
  // Reorder the gallery to exactly this ordered set of image ids.
  reorder(productId: number, imageIds: number[]): Promise<ProductImage[]>;
  remove(productId: number, imageId: number): Promise<void>;
}
