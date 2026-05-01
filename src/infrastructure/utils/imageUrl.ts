export function getImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/app/uploads/')) {
    return imageUrl.replace('/app/uploads/', '/api/uploads/');
  }
  return imageUrl;
}
