/**
 * Thumbnail collage (FEATURE_2610_21) — request/response shapes of `/api/admin/master-products/{masterId}/collage`.
 * File: src/domain/entities/CollageEntity.ts
 */

/** Collage shape (D30): ① ROW · ② COLUMN · ③ LEFT_BIG · ④ TOP_BIG · ⑤ TWO_ROWS. */
export type CollageShape = 'ROW' | 'COLUMN' | 'LEFT_BIG' | 'TOP_BIG' | 'TWO_ROWS';

/** One cell (D47): `zoom` 1 = covers the cell, `cx`·`cy` = photo point (0..1) at the cell centre. */
export interface CollageCell {
  productId: number;
  zoom: number;
  cx: number;
  cy: number;
}

/** One collage (D47) — every value is a ratio, so it draws at any template size. */
export interface CollageLayout {
  shape: CollageShape;
  /** Big-cell ratio 0.1..0.9 (LEFT_BIG width · TOP_BIG height · TWO_ROWS top-row height); null for ROW / COLUMN. */
  main: number | null;
  /** Cell-size ratios per line, each line sums to 1, one cell ≥ 0.1. */
  lines: number[][];
  /** Gap as a fraction of the short side, 0..0.05 (D44). */
  gap: number;
  /** `#RRGGBB` (D51). */
  gapColor: string;
  /** true = goes into the template's product-photo slot (D48). */
  useTemplate: boolean;
  cells: CollageCell[];
}

export type CollageStage = 'MASTER' | 'SELLER' | 'LISTING';

/** Which stored stage a stage currently uses (D41). */
export type CollageSource = 'OWN' | 'SELLER' | 'MASTER' | 'NONE';

export interface CollageProductView {
  productId: number;
  productName: string;
  /** Cover photo; null = no photo (D18). */
  imageUrl: string | null;
}

export interface CollageStageView {
  stage: CollageStage;
  sellerId: number | null;
  sellerName: string | null;
  listingId: number | null;
  platform: string | null;
  source: CollageSource;
  /** Whether the used stage is switched on; null when `source` is NONE. */
  enabled: boolean | null;
}

export interface CollageOverview {
  bundle: boolean;
  products: CollageProductView[];
  stages: CollageStageView[];
}

/** A template to preview with (D39 · D46). `listingId` null = the tenant default template. */
export interface CollagePreviewTarget {
  listingId: number | null;
  sellerName: string | null;
  platform: string | null;
  canvasWidth: number;
  canvasHeight: number;
  slotWidth: number | null;
  slotHeight: number | null;
}

export interface CollageStageResponse {
  stage: CollageStageView;
  bundle: boolean;
  products: CollageProductView[];
  shapes: CollageShape[];
  /** This stage's own switched-on collage (adjusted to the current components); null otherwise. */
  ownLayout: CollageLayout | null;
  /** The nearest upper stage's switched-on collage (adjusted); null when there is none. */
  inheritedLayout: CollageLayout | null;
  previewTargets: CollagePreviewTarget[];
}

/** Stage address of the API (`stage` + `sellerId` for SELLER / `listingId` for LISTING). */
export interface CollageStageKey {
  stage: CollageStage;
  sellerId?: number;
  listingId?: number;
}

export interface CollageSaveRequest {
  enabled: boolean;
  layout: CollageLayout | null;
}

export interface CollagePreviewRequest {
  listingId: number | null;
  layout: CollageLayout;
}
