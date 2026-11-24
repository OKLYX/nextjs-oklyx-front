'use client';

/**
 * Shared tab bar of the stock work screens — 「입고 작업」 and 「출고 작업」 (FEATURE_2611_34 R23).
 *
 * **File**: `src/app/dashboard/stock/components/WorkTabs.tsx`
 *
 * **Example**:
 * ```tsx
 * <WorkTabs
 *   tabs={[{ value: 'DISPOSAL', label: '폐기' }, { value: 'SUPPLIER_RETURN', label: '매입처 반품' }]}
 *   value={tab}
 *   onChange={setTab}
 * />
 * ```
 *
 * ⚠️ The pressed button is blurred right away: these screens read barcodes from page-wide keys, and a focused button
 * would be pressed again by the scanner's Enter.
 * ❌ Do not build a tab bar per screen — the stock work screens use this one.
 */
export interface WorkTabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function WorkTabs<T extends string>(props: WorkTabsProps<T>) {
  const { tabs, value, onChange } = props;
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={(event) => {
              event.currentTarget.blur();
              onChange(tab.value);
            }}
            // Same shape as `ClaimTypeTabs`: the inactive tab keeps a transparent border so the bar does not jump.
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
