/**
 * Marketplace platforms the server accepts (FEATURE_2610_22 / D10 · D15). The platform selects of the
 * sales-channel register / edit forms, the carrier platform codes, the margin presets, the repricing filters
 * and the sales-product edit form are built from this list.
 *
 * **Location**: src/config/platforms.ts
 * **History**: before 2609_24 the legacy register form (register/components/ProductListingForm.tsx:9)
 *          owned it. That screen went away and the list was promoted to config.
 *
 * ⚠️ A new marketplace adds its value here in its sales-channel work (D10).
 *    Mobile twin: `lib/core/utils/platform_display.dart` `kPlatforms`.
 */
export const PLATFORMS = ['COUPANG', 'ELEVENST', 'ESM'];

/**
 * Screen name of a platform value. The stored / API values stay `ELEVENST` and `ESM`; screens show 「11번가」 and
 * 「G마켓 · 옥션」 (FEATURE_2610_26 / D71). Other platforms are returned unchanged.
 *
 * ❌ Do not send the returned text to the server — it is display only.
 */
export const platformDisplayName = (platform: string): string => {
  if (platform === 'ELEVENST') return '11번가';
  if (platform === 'ESM') return 'G마켓 · 옥션';
  return platform;
};

const PLATFORM_NAMES: Record<string, string> = {
  COUPANG: '쿠팡',
  NAVER: '네이버',
  ELEVENST: '11번가',
  ESM: 'G마켓 · 옥션',
};

/**
 * Screen name of a platform value (FEATURE_2610_22 / D15 · D18): 「쿠팡」 · 「네이버」 · 「11번가」 · 「G마켓 · 옥션」
 * (FEATURE_2610_26 / D3). A value missing from the table is returned unchanged. The marketplace name tables and the
 * platform select labels use this.
 *
 * ❌ Do not send the returned text to the server — it is display only.
 * ❌ `platformDisplayName` does not call this — its callers keep their current text (D18).
 * Mobile twin: `lib/core/utils/platform_display.dart` `platformName`.
 */
export const platformName = (platform: string): string => PLATFORM_NAMES[platform] ?? platform;
