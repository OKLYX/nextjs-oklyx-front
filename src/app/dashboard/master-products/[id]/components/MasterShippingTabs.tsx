'use client';

import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import { ElevenstShippingFields } from '@/presentation/components/ElevenstShippingFields';
import { cleanElevenstMap, type ElevenstShippingMap } from '@/domain/entities/ElevenstShipping';
import { overrideToMap, type ShippingOverride } from '@/domain/entities/ShippingEntity';
import { lookupPlatformLabel, type LookupPlatform } from '../../components/platformCategory';

/** The 「통합」 tab key; the other tab keys are the platforms themselves. */
export const ALL_SHIPPING_TAB = 'ALL';
export type MasterShippingTab = typeof ALL_SHIPPING_TAB | LookupPlatform;

/**
 * Platforms whose shipping fields the master shows (FEATURE_2610_13 / D98 · D104): Coupang always, 11st when the
 * tenant has a switched-on 11st sales channel.
 */
export const shippingPlatformsOf = (activePlatforms: LookupPlatform[]): LookupPlatform[] =>
  activePlatforms.includes('ELEVENST') ? ['COUPANG', 'ELEVENST'] : ['COUPANG'];

/** The one master override map (D104): Coupang keys as they are + the `elevenst.*` keys. */
export const masterShippingMapOf = (
  coupang: ShippingOverride,
  elevenst: ElevenstShippingMap,
): Record<string, string> => ({ ...overrideToMap(coupang), ...cleanElevenstMap(elevenst) });

interface MasterShippingTabsProps {
  platforms: LookupPlatform[];
  tab: MasterShippingTab;
  onTabChange: (tab: MasterShippingTab) => void;
  coupang: ShippingOverride;
  onCoupangChange: (next: ShippingOverride) => void;
  elevenst: ElevenstShippingMap;
  onElevenstChange: (next: ElevenstShippingMap) => void;
  disabled?: boolean;
}

/**
 * Master shipping fields with the 「통합」 tab + one tab per platform (FEATURE_2610_13 / D104 · D105) — shared by the
 * master detail panel and the master create page.
 *
 * **File**: src/app/dashboard/master-products/[id]/components/MasterShippingTabs.tsx
 *
 * One platform → no tab bar, the Coupang fields as before. Two or more → 「통합」 (every platform's fields, grouped
 * under its name, no shared field) and one tab per platform (only that platform's fields, editable).
 * The parent owns the values and the tab, and saves {@link masterShippingMapOf}.
 *
 * ⚠️ Saving must send BOTH platforms' keys — the server keeps one map, and a map without the other platform's keys
 * erases them.
 */
export function MasterShippingTabs({
  platforms,
  tab,
  onTabChange,
  coupang,
  onCoupangChange,
  elevenst,
  onElevenstChange,
  disabled = false,
}: MasterShippingTabsProps) {
  const renderPlatform = (platform: LookupPlatform) =>
    platform === 'ELEVENST' ? (
      <ElevenstShippingFields level="master" value={elevenst} onChange={onElevenstChange} disabled={disabled} />
    ) : (
      <ShippingOverrideFields
        level="master"
        value={coupang}
        onChange={onCoupangChange}
        platform="COUPANG"
        disabled={disabled}
      />
    );

  if (platforms.length < 2) {
    return renderPlatform('COUPANG');
  }

  const tabs: MasterShippingTab[] = [ALL_SHIPPING_TAB, ...platforms];
  const active: MasterShippingTab = tabs.includes(tab) ? tab : ALL_SHIPPING_TAB;

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
              active === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === ALL_SHIPPING_TAB ? '통합' : lookupPlatformLabel(t)}
          </button>
        ))}
      </div>
      {active === ALL_SHIPPING_TAB ? (
        <div className="space-y-6">
          {platforms.map((platform) => (
            <section key={platform} className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">{lookupPlatformLabel(platform)}</h4>
              {renderPlatform(platform)}
            </section>
          ))}
        </div>
      ) : (
        renderPlatform(active)
      )}
    </div>
  );
}
