'use client';

import { useSyncExternalStore } from 'react';
import { useListViewStore, type ListViewMode } from '@/infrastructure/stores/listViewStore';

/**
 * Segmented toggle that switches a list between table and cards on a narrow screen (below md).
 *
 * **Purpose**: sits above a list table that has a card view. The user switches between the table (horizontal
 *   scroll) and the cards. The pick is kept in [[listViewStore]] and stays across screens.
 * **File**: src/presentation/components/ViewModeToggle.tsx
 *
 * **When it shows**: `md:hidden` — narrow screens only (wide screens always show the table, so it is not needed).
 *   Not rendered before mount, to avoid a hydration mismatch (same as the TopBar pattern).
 *
 * **Usage**: a list does not place it by hand — `TableCard` (`renderCards`) and `DataCardSwitch` draw it above the
 *   list (FEATURE_2610_31 D13):
 *   <TableCard isLoading={isLoading} isEmpty={rows.length === 0} renderCards={renderCards}>{table}</TableCard>
 *   <DataCardSwitch placement="nested" renderCards={renderCards}>{table}</DataCardSwitch>
 *
 * ⚠️ Do not put it on a table without a card renderer (there is nothing to switch to).
 * ❌ No hard-coded colours — the active colour is `bg-blue-600` (brand remap).
 */
const OPTIONS: { value: ListViewMode; label: string }[] = [
  { value: 'table', label: '표' },
  { value: 'card', label: '카드' },
];

export function ViewModeToggle({ className }: { className?: string }) {
  const viewMode = useListViewStore((state) => state.viewMode);
  const setViewMode = useListViewStore((state) => state.setViewMode);

  // Avoid hydration mismatch: the persisted value is client-only, so render
  // nothing until mounted (server/hydration = null), then the client value.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!mounted) return null;

  return (
    <div
      role="group"
      aria-label="리스트 보기 방식"
      className={`md:hidden inline-flex rounded-lg border border-gray-300 bg-white p-0.5 max-md:flex-wrap ${className ?? ''}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setViewMode(option.value)}
          aria-pressed={viewMode === option.value}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === option.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
