// Image-processing preset domain types. SSOT = backend contract (FEATURE_2608_08 / 01).
// Endpoints /api/admin/processing-presets (ADMIN), responses unwrapped from
// ResponseDTO<T> (response.data.data) in the Impl.
//
// A preset is a tenant-shared library entry referenced from a DetailTemplate
// (DetailTemplate.imageProcessingPresetId). When a channel's detail template
// carries a preset, its ops are burned onto the channel's detail zone images.

// 3×3 grid anchor (SSOT = backend ImageProcessor). Corners + edge-midpoints + center.
export type ImageOpAnchor =
  | 'TOP_LEFT'
  | 'TOP_CENTER'
  | 'TOP_RIGHT'
  | 'CENTER_LEFT'
  | 'CENTER'
  | 'CENTER_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT';

// A single ordered image op. v1 = overlay (burn a fixed library asset onto the
// base image). assetStorageKey = TemplateAsset.storageKey (resolveThumbUrl for display).
export interface ImageOp {
  type: 'overlay';
  assetStorageKey: string;
  anchor: ImageOpAnchor;
  opacity: number; // 0..1
  scalePercent: number; // overlay long side as % of base's short side
  marginPercent: number; // edge inset as % of base's short side
}

export interface ProcessingPreset {
  id: number;
  name: string;
  operations: ImageOp[];
  active: boolean;
}

// Create/update payload. active is fixed true on the front (thumbnail rule parity).
export interface ProcessingPresetRequest {
  name: string;
  operations: ImageOp[];
  active: boolean;
}
