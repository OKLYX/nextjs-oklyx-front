import { verticalCompactor, type Layout } from 'react-grid-layout';
import type { LayoutConstraint } from 'react-grid-layout/core';
import {
  DASHBOARD_CARD_ORDER,
  DASHBOARD_CARD_SPECS,
  WEB_GRID,
  allowedHeights,
  allowedWidths,
  effectivePeriod,
} from '@/config/dashboardGrid';
import {
  currentMonthRange,
  lastMonthRange,
  recentDaysRange,
  toDateInput,
} from '@/app/dashboard/sales/components/PeriodFilter';
import type {
  DashboardCardType,
  DashboardLayout,
  DashboardPeriod,
  DashboardWebCard,
} from '@/domain/entities/DashboardEntity';

/**
 * Web dashboard placement rules (FEATURE_2610_29 D9 · D11 · D18 · D19) — pure functions, no React.
 *
 * **Purpose**: turn the stored cards into the cards the grid draws, and back.
 * **File**: src/app/dashboard/components/home/dashboardLayout.ts
 *
 * ⚠️ Sizes come from `src/config/dashboardGrid.ts` (D10).
 */

/** One card the web grid draws. */
export interface WebCard {
  type: DashboardCardType;
  /** The period the card reads; null = the card has no period. */
  period: DashboardPeriod | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** First visit (D19): admin = the four counts + the two charts, others = the four counts, in the D8 order. */
const DEFAULT_ADMIN: Omit<WebCard, 'period'>[] = [
  { type: 'PAID_ORDERS', x: 0, y: 0, w: 1, h: 1 },
  { type: 'NEW_ORDERS', x: 1, y: 0, w: 1, h: 1 },
  { type: 'OPEN_CLAIMS', x: 2, y: 0, w: 1, h: 1 },
  { type: 'UNANSWERED_INQUIRIES', x: 3, y: 0, w: 1, h: 1 },
  { type: 'DAILY_SALES_CHART', x: 4, y: 0, w: 4, h: 2 },
  { type: 'CHANNEL_SALES_CHART', x: 0, y: 1, w: 4, h: 2 },
];

const DEFAULT_STAFF: Omit<WebCard, 'period'>[] = DEFAULT_ADMIN.filter(
  (card) => !DASHBOARD_CARD_SPECS[card.type].adminOnly,
);

/** Cards the member may see (D9). */
export function visibleTypes(admin: boolean): DashboardCardType[] {
  return DASHBOARD_CARD_ORDER.filter((type) => admin || !DASHBOARD_CARD_SPECS[type].adminOnly);
}

/** The largest allowed size at or below `stored`; the minimum when there is none (D18). */
function shrink(stored: number, allowed: number[]): number {
  const fitting = allowed.filter((size) => size <= stored);
  return fitting.length > 0 ? Math.max(...fitting) : allowed[0];
}

/** Bottom row of the cards (the row under the lowest card). */
function bottom(cards: WebCard[]): number {
  return cards.reduce((max, card) => Math.max(max, card.y + card.h), 0);
}

/** Overlaps resolved top to bottom and cards moved up into the free cells (D18) — the grid's own compactor. */
function compact(cards: WebCard[]): WebCard[] {
  const compacted = verticalCompactor.compact(
    cards.map((card) => ({ i: card.type, x: card.x, y: card.y, w: card.w, h: card.h })),
    WEB_GRID.cols,
  );
  return cards.map((card) => {
    const item = compacted.find((entry) => entry.i === card.type);
    return item ? { ...card, x: item.x, y: item.y, w: item.w, h: item.h } : card;
  });
}

/** A new card at the bottom, left edge, with its first size (D11 · D15). */
export function placeAtBottom(cards: WebCard[], type: DashboardCardType): WebCard[] {
  const spec = DASHBOARD_CARD_SPECS[type];
  return compact([
    ...cards,
    { type, period: spec.defaultPeriod, x: 0, y: bottom(cards), w: spec.initW, h: spec.initH },
  ]);
}

/**
 * Stored cards → the cards the grid draws (D9 · D11 · D18 · D19).
 *
 * 1. Not saved yet → the default cards of the role (D19).
 * 2. Admin cards are dropped for a non-admin (D9).
 * 3. A stored size the spec does not have shrinks to the largest allowed size below it, not under the minimum,
 *    and the card is pulled left until it fits in the columns (D18).
 * 4. Cards without a web place (added on mobile) go to the bottom in the D8 order with their first size (D11).
 * 5. Overlaps are resolved top to bottom (D18).
 */
export function toWebCards(layout: DashboardLayout): WebCard[] {
  if (!layout.saved) {
    return (layout.admin ? DEFAULT_ADMIN : DEFAULT_STAFF).map((card) => ({
      ...card,
      period: DASHBOARD_CARD_SPECS[card.type].defaultPeriod,
    }));
  }
  const visible = new Set(visibleTypes(layout.admin));
  const shown = layout.cards.filter((card) => visible.has(card.cardType));
  const placed: WebCard[] = [];
  const unplaced: DashboardCardType[] = [];
  for (const card of shown) {
    if (card.webX === null || card.webY === null || card.webW === null || card.webH === null) {
      unplaced.push(card.cardType);
      continue;
    }
    const w = shrink(card.webW, allowedWidths(card.cardType));
    const h = shrink(card.webH, allowedHeights(card.cardType));
    placed.push({
      type: card.cardType,
      period: effectivePeriod(card.cardType, card.period),
      x: Math.min(Math.max(card.webX, 0), WEB_GRID.cols - w),
      y: Math.max(card.webY, 0),
      w,
      h,
    });
  }
  let cards = compact(placed);
  for (const type of DASHBOARD_CARD_ORDER.filter((entry) => unplaced.includes(entry))) {
    const stored = shown.find((card) => card.cardType === type);
    cards = placeAtBottom(cards, type).map((card) =>
      card.type === type ? { ...card, period: effectivePeriod(type, stored?.period ?? null) } : card,
    );
  }
  return cards;
}

/** Grid layout of the cards (`i` = card type). `minW` / `minH` feed the size constraint below. */
export function toGridLayout(cards: WebCard[]): Layout {
  return cards.map((card) => ({
    i: card.type,
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
    minW: DASHBOARD_CARD_SPECS[card.type].minW,
    minH: DASHBOARD_CARD_SPECS[card.type].minH,
  }));
}

/**
 * Places and sizes from the grid back onto the cards (after a drag or a resize). Returns `cards` itself when nothing
 * moved, so the grid's own change report does not re-render the page.
 */
export function fromGridLayout(cards: WebCard[], layout: Layout): WebCard[] {
  let changed = false;
  const next = cards.map((card) => {
    const item = layout.find((entry) => entry.i === card.type);
    if (!item || (item.x === card.x && item.y === card.y && item.w === card.w && item.h === card.h)) return card;
    changed = true;
    return { ...card, x: item.x, y: item.y, w: item.w, h: item.h };
  });
  return changed ? next : cards;
}

/** Body of PUT /api/dashboard/layout/web. */
export function toWebRequest(cards: WebCard[]): DashboardWebCard[] {
  return cards.map((card) => ({
    cardType: card.type,
    period: card.period,
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  }));
}

/** The allowed size nearest to `size`; a tie goes to the smaller size. */
function nearest(size: number, allowed: number[]): number {
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
  );
}

/**
 * Resize constraint (D7 · D15 · D16): the width snaps to 1 · 2 · 4 and the height to 1 · 2, not under the card's
 * minimum, and the width does not run past the last column.
 */
export const dashboardSizes: LayoutConstraint = {
  name: 'dashboardSizes',
  constrainSize(item, w, h) {
    const widths = WEB_GRID.widths.filter((size) => size >= (item.minW ?? 1) && item.x + size <= WEB_GRID.cols);
    const heights = WEB_GRID.heights.filter((size) => size >= (item.minH ?? 1));
    return {
      w: widths.length > 0 ? nearest(w, widths) : item.w,
      h: heights.length > 0 ? nearest(h, heights) : item.h,
    };
  },
};

/** Dates of a period (D22 · D23), `yyyy-MM-dd` in local time. */
export function periodRange(period: DashboardPeriod): { from: string; to: string } {
  switch (period) {
    case 'TODAY': {
      const today = toDateInput(new Date());
      return { from: today, to: today };
    }
    case 'DAYS_7':
      return recentDaysRange(7);
    case 'DAYS_30':
      return recentDaysRange(30);
    case 'THIS_MONTH':
      return currentMonthRange();
    case 'LAST_MONTH':
      return lastMonthRange();
  }
}
