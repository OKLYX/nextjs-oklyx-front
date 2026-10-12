import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

/**
 * Platforms whose category can be picked in the lookup picker — Coupang and 11st (FEATURE_2610_11 / D1).
 * Naver has no category list, so these screens never ask for it and never block it (D18 (d) — the server
 * still refuses a Naver upload without a mapping).
 * File: src/app/dashboard/master-products/components/platformCategory.ts
 */
export type LookupPlatform = 'COUPANG' | 'ELEVENST';

export const LOOKUP_PLATFORMS: LookupPlatform[] = ['COUPANG', 'ELEVENST'];

const LOOKUP_PLATFORM_LABEL: Record<LookupPlatform, string> = {
  COUPANG: '쿠팡',
  ELEVENST: '11번가',
};

/** `platform` narrowed to a lookup platform, or null (Naver and any other platform). */
export const asLookupPlatform = (platform: string): LookupPlatform | null =>
  LOOKUP_PLATFORMS.find((p) => p === platform) ?? null;

/** Screen label of a lookup platform (「쿠팡」 · 「11번가」). */
export const lookupPlatformLabel = (platform: LookupPlatform): string => LOOKUP_PLATFORM_LABEL[platform];

/** Lookup platforms that have at least one switched-on sales-channel account (D17). */
export const activeLookupPlatformsOf = (accounts: MarketplaceAccount[]): LookupPlatform[] =>
  LOOKUP_PLATFORMS.filter((p) => accounts.some((a) => a.isActive && a.platform === p));

/** Of `platforms`, the ones the standard category has no mapping row for (D6 — a row without FK counts as mapped). */
export const missingPlatformsOf = (
  platforms: LookupPlatform[],
  mappings: CategoryMapping[],
): LookupPlatform[] => platforms.filter((p) => !mappings.some((m) => m.platform === p));

/** Notice shown where the upload buttons are hidden (D18 (h)). */
export const categoryBlockReason = (platform: LookupPlatform): string =>
  `카테고리 연결 필요 — 이 기준 카테고리에 ${lookupPlatformLabel(platform)} 카테고리가 없어 올릴 수 없습니다.`;
