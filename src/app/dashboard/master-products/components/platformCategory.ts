import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import type { MasterPlatformCategory } from '@/domain/entities/MasterProductEntity';

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

/**
 * Platforms the missing-category popup asks for (FEATURE_2610_12 / D35): 11st always, Coupang only with a
 * switched-on account (`activePlatforms`, D17).
 */
export const promptPlatformsOf = (activePlatforms: LookupPlatform[]): LookupPlatform[] =>
  LOOKUP_PLATFORMS.filter((p) => p === 'ELEVENST' || activePlatforms.includes(p));

/**
 * Of `platforms`, the ones with no row in `rows` — the standard category's mapping rows plus the master's own
 * platform categories (D6 — a row without FK counts as mapped · FEATURE_2610_12 / D41 — an own row counts too).
 */
export const missingPlatformsOf = (
  platforms: LookupPlatform[],
  rows: { platform: string }[],
): LookupPlatform[] => platforms.filter((p) => !rows.some((m) => m.platform === p));

/** One platform category line (FEATURE_2610_12 / D50). `path` null = no category · `own` = 「개별 지정」. */
export interface PlatformCategoryRow {
  platform: LookupPlatform;
  path: string | null;
  own: boolean;
}

/**
 * The D50 lines, 「쿠팡」 → 「11번가」: the master's own row wins (D41), else the standard category mapping, else none.
 * Path = the cached display path, or the code when no path was cached.
 */
export const platformCategoryRowsOf = (
  mappings: CategoryMapping[],
  owns: MasterPlatformCategory[],
): PlatformCategoryRow[] =>
  LOOKUP_PLATFORMS.map((platform) => {
    const own = owns.find((o) => o.platform === platform);
    if (own) return { platform, path: own.platformCategoryName || own.platformCategoryId, own: true };
    const mapping = mappings.find((m) => m.platform === platform);
    return {
      platform,
      path: mapping ? mapping.platformCategoryName || mapping.platformCategoryId : null,
      own: false,
    };
  });

/** Notice shown where the upload buttons are hidden (D18 (h)). */
export const categoryBlockReason = (platform: LookupPlatform): string =>
  `카테고리 연결 필요 — 이 기준 카테고리에 ${lookupPlatformLabel(platform)} 카테고리가 없어 올릴 수 없습니다.`;
