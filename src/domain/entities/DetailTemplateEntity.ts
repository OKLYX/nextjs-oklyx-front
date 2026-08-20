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
  textStyle?: Record<string, string> | null; // text = inline style overrides (fontSize/color/bold/italic ...)
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

// Reserved field key for the cover photo (master source image). Mirrors the
// backend constant SOURCE_ZONE = "__source__". Single definition on the front.
export const SOURCE_ZONE = '__source__';

// A master pool image with its field-mapping state (backend 37).
// One pool image is reusable across many detail zones + the cover photo (M:N).
// ⚠️ `imageUrl` is an already-complete URL → use directly in <img src>, never
// resolveThumbUrl (double-wrapping breaks the path). Same rule everywhere.
// `assignedZones` = the detail zones this image is mapped to (excludes the
// cover-photo key); `isSource` = true if it is the master's cover photo.
export interface MasterPoolImage {
  id: number;
  imageUrl: string;
  sortOrder: number;
  assignedZones: string[];
  isSource: boolean;
  // Linked product image slot id when this is a reference entry (backend 40);
  // null for an edited (master-owned) entry.
  productImageId?: number | null;
}

// Idempotent replace: `imageIds` = the full ordered set mapped to a zone
// (empty clears). Order = sortOrder within the zone.
export interface SetZoneImagesRequest {
  imageIds: number[];
}

// imageId = null clears the cover photo (→ derived from BOM); a value sets it.
export interface SetSourceImageRequest {
  imageId: number | null;
}
