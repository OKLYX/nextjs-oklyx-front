import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

export function getImageUrl(imageUrl: string | null | undefined, productId?: number): string | null {
  if (!imageUrl) return null;
  // Use frontend proxy with token in query parameter
  if (productId) {
    const token = tokenStorage.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `/api/products/${productId}/image-proxy${tokenParam}`;
  }
  return imageUrl;
}

/**
 * Resolve a product's representative image (`Product.imageUrl`) to a list-friendly src.
 *
 * dev/prod store product images on S3 (public read) → the stored value is a full
 * http URL and the browser loads it directly, so a list of N rows costs no server
 * hops. Local/test store a disk-relative path → fall back to the authenticated
 * backend proxy (`getImageUrl`), same as the product detail page.
 *
 * ⚠️ Per-image gallery URLs (`ProductImage.imageUrl`) must keep using
 * `resolveThumbUrl` — never the productId proxy, which returns the representative
 * image for every card.
 *
 * @param imageUrl - `Product.imageUrl` from the backend (http URL or disk path)
 * @param productId - product id, used only for the local proxy fallback
 * @returns browser-loadable src, or null when the product has no image
 */
export function getProductThumbUrl(
  imageUrl: string | null | undefined,
  productId: number
): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return getImageUrl(imageUrl, productId);
}
