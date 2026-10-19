import { platformDisplayName } from '@/config/platforms';
import type {
  CollagePreviewTarget,
  CollageStageKey,
  CollageStageView,
} from '@/domain/entities/CollageEntity';

/**
 * Screen labels of the thumbnail collage (FEATURE_2610_21 D40 · D41 · D46) — shared by the editor page and the
 * master 「이미지」 tab block.
 * File: src/app/dashboard/master-products/[id]/collage/components/collageLabels.ts
 */

const platformLabel = (platform: string | null): string => (platform ? platformDisplayName(platform) : '');

/** Stage name (D41 「편집 중인 단계」). */
export function stageLabel(view: CollageStageView): string {
  if (view.stage === 'MASTER') return '마스터 기본';
  if (view.stage === 'SELLER') return `판매자 · ${view.sellerName ?? ''}`;
  return `판매상품 · ${view.sellerName ?? ''} · ${platformLabel(view.platform)} #${view.listingId}`;
}

/** What the stage currently uses (D40 · D41 · D42). */
export function sourceLabel(view: CollageStageView): string {
  switch (view.source) {
    case 'OWN':
      return view.enabled ? '따로 만듦' : '끔 (사진 한 장 썸네일)';
    case 'SELLER':
      return view.enabled ? '판매자 것을 따름' : '판매자 것을 따름 (판매자 단계에서 끔)';
    case 'MASTER':
      return view.enabled ? '마스터 기본을 따름' : '마스터 기본을 따름 (마스터 기본에서 끔)';
    case 'NONE':
      return '없음 (사진 한 장 썸네일)';
  }
}

/** Preview template choice (D46). */
export function targetLabel(target: CollagePreviewTarget): string {
  if (target.listingId == null) return '기본 썸네일 틀';
  return `${target.sellerName ?? ''} · ${platformLabel(target.platform)} #${target.listingId}`;
}

/** The API stage address of a stage view. */
export function stageKeyOf(view: CollageStageView): CollageStageKey {
  if (view.stage === 'SELLER') return { stage: 'SELLER', sellerId: view.sellerId ?? undefined };
  if (view.stage === 'LISTING') return { stage: 'LISTING', listingId: view.listingId ?? undefined };
  return { stage: 'MASTER' };
}
