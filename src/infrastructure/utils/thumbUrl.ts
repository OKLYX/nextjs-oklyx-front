/**
 * Resolve a stored image key/URL to a browser-loadable src.
 *
 * dev/prod thumbnails and template assets are public URLs (start with http) and
 * are used directly; local disk paths go through the uploads proxy. Shared by the
 * product detail thumbnails, the template asset grid, and the editor.
 *
 * @param imageUrl - storageKey/imageUrl from the backend (http URL or local path)
 * @param bust - optional cache-buster appended as `?t=` / `&t=`
 */
export function resolveThumbUrl(imageUrl: string, bust?: number): string {
  const base = imageUrl.startsWith('http') ? imageUrl : `/api/uploads/${imageUrl.replace(/^\/+/, '')}`;
  if (!bust) return base;
  return `${base}${base.includes('?') ? '&' : '?'}t=${bust}`;
}
