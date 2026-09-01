/**
 * Tenant font library item (SSOT for the font type — shared by the thumbnail
 * editor and the detail-template editor). Source = backend `FontAssetResponse`
 * served by `/api/admin/fonts`.
 *
 * ⚠️ Do NOT redefine this shape anywhere else; `ThumbnailEntity.ts` only
 * re-exports it so the existing thumbnail import paths keep working.
 *
 * Detail-page usability (backend `DetailFontResolver`):
 * - `webUrl != null`  → the font file is embedded via `@font-face` (uploaded font)
 * - `webUrl == null && webStack != null` → device-installed font names only
 * - both null → not usable in a detail page (thumbnail-only font)
 */
export interface FontAsset {
  id: number;
  displayName: string;
  familyKey: string;
  source: 'BUNDLED' | 'UPLOADED';
  system: boolean; // tenantId == null (system-shared, tenant cannot delete)
  webStack: string | null; // device-installed fallback stack, e.g. "'Nanum Gothic',sans-serif"
  webUrl: string | null; // public font file URL; non-null = usable in detail HTML via @font-face
}
