/**
 * Abbreviate a full address to its leading region tokens for list display.
 *
 * Splits on whitespace and keeps the first 2 tokens (e.g. "울산광역시 중구 ...롯데캐슬" → "울산광역시 중구").
 * Used to avoid rendering the full address (personal info) on screen — the full value stays in
 * component state only, for the export POST.
 */
export function addressHead(address: string | null | undefined): string {
  if (!address) return '';
  return address.trim().split(/\s+/).slice(0, 2).join(' ');
}
