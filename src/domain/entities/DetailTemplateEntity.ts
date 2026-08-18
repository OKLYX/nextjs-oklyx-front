// Detail-page (3-layer block editor) domain types. SSOT = backend contract (prompt 11).
// All endpoints are /api/admin/** (ADMIN), responses unwrapped from ResponseDTO<T>
// (response.data.data) in the Impl.
//
// ⚠️ GeneratedProductResponse / FieldValuesUpdateRequest / GeneratedSource live in
// ListingRegistrationEntity.ts — import & reuse, never redefine here.

// A single detail block. `text` binds a field key, `imageZone` binds a zoneId,
// `asset` is a fixed read-only image, `spacer` is a vertical gap (heightPx).
export interface DetailBlock {
  type: 'text' | 'imageZone' | 'asset' | 'spacer';
  bind: string | null; // text=fieldKey, imageZone=zoneId
  src: string | null; // asset=fixed image storageKey
  defaultValue: string | null; // text fallback
  widthPercent: number | null;
  align: string | null; // 'left' | 'center' | 'right'
  heightPx: number | null; // spacer=vertical gap in px
}

export interface DetailTemplateResponse {
  id: number;
  name: string;
  blocks: DetailBlock[];
  active: boolean;
  isDefault: boolean;
  blockCount?: number;
}

// Create/update payload for the tenant-shared detail template (prompt 17).
export interface DetailTemplateRequest {
  name: string;
  blocks: DetailBlock[];
  active: boolean;
  isDefault: boolean;
}

export interface DetailPreviewResponse {
  html: string;
}

// @NotNull on the backend; an empty string is allowed (null is rejected).
export interface DetailHtmlOverrideRequest {
  html: string;
}

// Master-owned zone image (shared across all channels of the same master).
// `imageUrl` is an already-complete URL → use directly in <img src>, never
// resolveThumbUrl (double-wrapping breaks the path).
export interface MasterProductImageResponse {
  id: number;
  zoneId: string;
  sortOrder: number;
  imageUrl: string;
}

// `imageIds` = the full set of ids in `zoneId`, in the new order. The backend
// validates the set matches; a partial payload is rejected (400).
export interface MasterImageReorderRequest {
  zoneId: string;
  imageIds: number[];
}
