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
