'use client';

import { useListViewStore } from '@/infrastructure/stores/listViewStore';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';

/**
 * true = draw the lists as cards (FEATURE_2610_31 D13): the screen is narrower than 768px and the list view mode
 * (`listViewStore`, shared by every list) is `card`.
 *
 * **File**: src/presentation/hooks/useShowCards.ts
 * **Used by**: `TableCard` · `DataCardSwitch` (they switch the table and the cards), and screens whose other parts
 * change with the card view (a titled box drawn without its frame — D30, the sort selector above the cards — D31).
 *
 * **Usage**:
 * ```tsx
 * const showCards = useShowCards();
 * <Card title="입고 후보" bare={showCards}>…</Card>
 * ```
 *
 * ⚠️ Always false at 768px and up — wide screens keep the table (D4).
 */
export function useShowCards(): boolean {
  const isMobile = useIsMobile();
  const viewMode = useListViewStore((state) => state.viewMode);
  return isMobile && viewMode === 'card';
}
