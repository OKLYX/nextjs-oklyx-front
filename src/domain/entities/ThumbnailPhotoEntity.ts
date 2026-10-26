/**
 * Thumbnail photo stages (FEATURE_2610_32) — request/response shapes of
 * `/api/admin/master-products/{masterId}/thumbnail-photo`.
 * File: src/domain/entities/ThumbnailPhotoEntity.ts
 */

/**
 * Field key of the 「썸네일 사진」 card in `MasterImagePool` (D13 (가)). Screen-only: the card reads and writes the
 * MASTER stage through the thumbnail-photo API — never send this key to the zone-mapping API.
 */
export const THUMBNAIL_PHOTO_FIELD = '__thumbnail_photo__';

export type ThumbnailPhotoStage = 'MASTER' | 'SELLER' | 'LISTING';

/** Where a stage's single-photo thumbnail base comes from (D14 · D32 — six values). */
export type ThumbnailPhotoSource =
  | 'OWN'
  | 'SELLER'
  | 'MASTER'
  | 'COVER'
  | 'LEGACY_UPLOAD'
  | 'FIRST_COMPONENT';

/** One stage row of `GET …/thumbnail-photo` (D31). */
export interface ThumbnailPhotoStageView {
  stage: ThumbnailPhotoStage;
  sellerId: number | null;
  sellerName: string | null;
  listingId: number | null;
  platform: string | null;
  source: ThumbnailPhotoSource;
  /** OWN · SELLER · MASTER = the chosen pool image · COVER = the cover pool image · otherwise null. */
  imageId: number | null;
  /** Complete URL of `imageId` (like `MasterPoolImage.imageUrl` — use directly in `<img src>`). */
  imageUrl: string | null;
  /** A switched-on collage is used for this stage, so the photo applies only once it is switched off (D6). */
  collageUsed: boolean;
}

/** Body of `PUT …/thumbnail-photo` (D23) — `imageId` null clears this stage's own choice. */
export interface ThumbnailPhotoRequest {
  stage: ThumbnailPhotoStage;
  sellerId: number | null;
  listingId: number | null;
  imageId: number | null;
}
