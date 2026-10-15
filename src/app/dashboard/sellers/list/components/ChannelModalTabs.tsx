'use client';

export type ChannelTabKey = 'basic' | 'platform' | 'shipping';

/** FEATURE_2610_16 / D20 · D26: the tabs of the sales channel info and edit modals, in this order. */
export const CHANNEL_TABS: { key: ChannelTabKey; label: string }[] = [
  { key: 'basic', label: '기본 정보' },
  { key: 'platform', label: '플랫폼 기본값' },
  { key: 'shipping', label: '배송' },
];

interface ChannelTabBarProps {
  active: ChannelTabKey;
  onSelect: (key: ChannelTabKey) => void;
}

/**
 * Tab bar of ChannelDetailsModal and ChannelEditForm (same look as MasterSectionTabs).
 * The panels stay mounted and are hidden with the `hidden` attribute, so unsaved input survives a tab switch.
 */
export function ChannelTabBar({ active, onSelect }: ChannelTabBarProps) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200 px-2">
      {CHANNEL_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onSelect(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            active === t.key
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
