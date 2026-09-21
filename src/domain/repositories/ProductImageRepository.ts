import type { ProductImage } from '@/domain/entities/ProductImage';

// A product's 1:N source image gallery (backend 39). All endpoints are ADMIN
// under /api/admin/products/{productId}/images. Responses are unwrapped from
// ResponseDTO<T> (response.data.data) in the Impl.
export interface ProductImageRepository {
  list(productId: number): Promise<ProductImage[]>;
  // Multipart: append each file as `files`. One POST adds all of them.
  add(productId: number, files: File[]): Promise<ProductImage[]>;
  // Copy other products' gallery images into this product by reference — the file is shared,
  // not re-uploaded (backend FEATURE_2609_62/01). Sources that no longer exist are skipped
  // silently, so compare the returned length with the requested ids to detect a partial copy.
  copy(productId: number, sourceImageIds: number[]): Promise<ProductImage[]>;
  // Download marketplace image URLs into this product's gallery (FEATURE_2609_67/D5). The server
  // fetches each URL and stores the bytes in our storage — the marketplace URL is NOT saved.
  // Only https `*.coupangcdn.com` URLs are allowed and at most 10 per call (backend 400 otherwise).
  addFromUrls(productId: number, urls: string[]): Promise<ProductImage[]>;
  // Replace one image in place (keeps the same image id).
  replace(productId: number, imageId: number, file: File): Promise<ProductImage>;
  // Reorder the gallery to exactly this ordered set of image ids.
  reorder(productId: number, imageIds: number[]): Promise<ProductImage[]>;
  remove(productId: number, imageId: number): Promise<void>;
}
