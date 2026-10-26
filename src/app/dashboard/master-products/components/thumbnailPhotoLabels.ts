import { platformDisplayName } from '@/config/platforms';
import type {
  ThumbnailPhotoSource,
  ThumbnailPhotoStageView,
} from '@/domain/entities/ThumbnailPhotoEntity';

/**
 * Screen labels of the thumbnail photo stages (FEATURE_2610_32 D14 · D27 · D32) — shared by the master 「이미지」 tab
 * block 「단계별 썸네일 사진」 and the listing 「썸네일」 tab.
 * File: src/app/dashboard/master-products/components/thumbnailPhotoLabels.ts
 */

/** Status text per source (D14 · D32 — six texts). */
export const THUMBNAIL_PHOTO_SOURCE_LABEL: Record<ThumbnailPhotoSource, string> = {
  OWN: '따로 고름',
  SELLER: '판매자 것을 따름',
  MASTER: '마스터 썸네일 사진을 따름',
  COVER: '대표사진을 따름',
  LEGACY_UPLOAD: '옛 바탕사진을 따름',
  FIRST_COMPONENT: '첫 구성품 사진을 따름',
};

/** Shown next to the status when a switched-on collage is used for the stage (D6 · D14). */
export const THUMBNAIL_PHOTO_COLLAGE_NOTICE = '콜라주가 쓰임 — 썸네일 사진은 콜라주를 끄면 쓰인다';

/** Name of one stage row (same wording as the 「썸네일 콜라주」 block). */
export function thumbnailPhotoStageLabel(view: ThumbnailPhotoStageView): string {
  if (view.stage === 'MASTER') return '마스터';
  if (view.stage === 'SELLER') return `판매자 · ${view.sellerName ?? ''}`;
  const platform = view.platform ? platformDisplayName(view.platform) : '';
  return `판매상품 · ${view.sellerName ?? ''} · ${platform} #${view.listingId}`;
}
