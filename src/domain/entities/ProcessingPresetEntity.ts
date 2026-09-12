// Image-processing preset domain types. SSOT = backend contract (FEATURE_2608_08 / 01).
// Endpoints /api/admin/processing-presets (ADMIN), responses unwrapped from
// ResponseDTO<T> (response.data.data) in the Impl.
//
// A preset is a tenant-shared library entry referenced from a DetailTemplate
// (DetailTemplate.imageProcessingPresetId). When a channel's detail template
// carries a preset, its ops are burned onto the channel's detail zone images.

// 색보정 파라미터 4개의 SSOT = infrastructure/utils/colorLut.ts (백엔드 공식 미러).
// 여기서는 import 해 재-export 만 한다(재정의 금지).
import type { ColorAdjust } from '@/infrastructure/utils/colorLut';

export type { ColorAdjust };

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

// Burn a fixed library asset onto the base image.
// assetStorageKey = TemplateAsset.storageKey (resolveThumbUrl for display).
export interface OverlayOp {
  type: 'overlay';
  assetStorageKey: string;
  anchor: ImageOpAnchor;
  opacity: number; // 0..1
  scalePercent: number; // overlay long side as % of base's short side
  marginPercent: number; // edge inset as % of base's short side
}

// 원본(base) 이미지 전용 색보정 (FEATURE_2609_35). 백엔드는 리스트 위치와 무관하게
// 오버레이보다 먼저 적용하고, 오버레이는 절대 보정하지 않는다.
// ⚠️ Partial 필수 — 구 프리셋 JSON 에는 4필드가 아예 없어 응답이 null/undefined 로 온다.
export interface ColorAdjustOp extends Partial<ColorAdjust> {
  type: 'colorAdjust';
}

// A single image op, discriminated by `type`.
export type ImageOp = OverlayOp | ColorAdjustOp;

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
