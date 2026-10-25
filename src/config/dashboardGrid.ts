import { ROUTES } from '@/config/routes';
import type { DashboardCardType, DashboardPeriod } from '@/domain/entities/DashboardEntity';

/**
 * Web dashboard grid and card sizes — defined here (FEATURE_2610_29 D5 · D7 · D10 · D15 · D17).
 *
 * **Purpose**: the invisible grid of the dashboard home (`/dashboard`) and the sizes each card may take.
 * **Rule**: cards do not write a column count or a pixel size — they read this file. Change a value here and the
 * cards follow on the next render; a stored size the new spec does not have is shrunk on screen (D18,
 * `dashboardLayout.ts`).
 * **File**: src/config/dashboardGrid.ts
 *
 * **Usage**:
 * ```ts
 * DASHBOARD_CARD_SPECS.PERIOD_SALES.minW          // 2
 * allowedWidths('PERIOD_SALES')                   // [2, 4]
 * effectivePeriod('PERIOD_SALES', null)           // 'THIS_MONTH'
 * ```
 *
 * ⚠️ The mobile app has its own copy of the card table
 *    (`lib/features/dashboard/presentation/utils/dashboard_grid_spec.dart`) — titles and periods must stay the same
 *    text.
 * ❌ Do not add a card here without a decision (D8 list).
 */
export const WEB_GRID = {
  /** Columns across (D5). */
  cols: 8,
  /** Height of one row in px (D17). */
  rowHeight: 120,
  /** Space between cells in px, both directions (D17). */
  gap: 16,
  /** Card widths in cells (D7). */
  widths: [1, 2, 4],
  /** Card heights in cells (D7). */
  heights: [1, 2],
} as const;

/**
 * Dashboard grid below 768px (FEATURE_2610_31 D17) — the mobile app's columns (`MobileGrid` in
 * `lib/features/dashboard/presentation/utils/dashboard_grid_spec.dart`): 2 columns, a card one row high or, when
 * its spec is `narrowTall`, two rows high.
 * Rows are the web rows (2026-10-25), so a card keeps its wide-screen height ratio; the app keeps its own heights.
 */
export const NARROW_GRID = {
  /** Columns across. */
  cols: 2,
  /** Height of one row in px — the web row. */
  rowHeight: WEB_GRID.rowHeight,
  /** Height of a tall card in px — two web rows and the gap between them. */
  tallHeight: 2 * WEB_GRID.rowHeight + WEB_GRID.gap,
  /** Space between cells in px, both directions. */
  gap: 12,
  /** Card widths in cells. */
  widths: [1, 2],
} as const;

export interface DashboardCardSpec {
  /** Card title on the card and in the picker. */
  title: string;
  /** true = hidden from non-admin members (D9). */
  adminOnly: boolean;
  /** Smallest width / height in cells (D15). */
  minW: number;
  minH: number;
  /** Size a new card gets (D15). */
  initW: number;
  initH: number;
  /** Smallest width / width of a card without a mobile place, in `NARROW_GRID` cells — the app's `minWidth` · `initialWidth` (FEATURE_2610_31 D17). */
  narrowMinW: number;
  narrowInitW: number;
  /** true = drawn `NARROW_GRID.tallHeight` high below 768px; only full-width cards, so a row never mixes heights. */
  narrowTall?: boolean;
  /** Screen a tap opens (D21). */
  href: string;
  /** Periods the card offers, in selector order; empty = no period (D22 · D23). */
  periods: DashboardPeriod[];
  /** Period used while none is stored; null = no period (D22 · D23). */
  defaultPeriod: DashboardPeriod | null;
}

/** The D8 order — picker order and the order cards without a web place are put at the bottom (D11). */
export const DASHBOARD_CARD_ORDER: DashboardCardType[] = [
  'PAID_ORDERS',
  'NEW_ORDERS',
  'OPEN_CLAIMS',
  'UNANSWERED_INQUIRIES',
  'PERIOD_SALES',
  'SETTLEMENT_PAYOUTS',
  'PURCHASE_LIST',
  'RESERVED_SHIPMENTS',
  'DAILY_SALES_CHART',
  'CHANNEL_SALES_CHART',
];

export const DASHBOARD_CARD_SPECS: Record<DashboardCardType, DashboardCardSpec> = {
  PAID_ORDERS: { title: '결제완료 주문 수', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, narrowMinW: 1, narrowInitW: 1, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  NEW_ORDERS: { title: '새 주문 수', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, narrowMinW: 1, narrowInitW: 1, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  OPEN_CLAIMS: { title: '처리 안 된 반품 · 교환', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, narrowMinW: 1, narrowInitW: 1, href: ROUTES.ORDERS_CLAIMS, periods: [], defaultPeriod: null },
  UNANSWERED_INQUIRIES: { title: '답 안 한 고객문의', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, narrowMinW: 1, narrowInitW: 1, href: ROUTES.ORDERS_INQUIRIES, periods: [], defaultPeriod: null },
  PERIOD_SALES: { title: '기간 매출', adminOnly: true, minW: 2, minH: 1, initW: 2, initH: 1, narrowMinW: 2, narrowInitW: 2, href: ROUTES.SALES_SUMMARY, periods: ['TODAY', 'DAYS_7', 'THIS_MONTH'], defaultPeriod: 'THIS_MONTH' },
  SETTLEMENT_PAYOUTS: { title: '정산 지급', adminOnly: true, minW: 2, minH: 2, initW: 2, initH: 2, narrowMinW: 2, narrowInitW: 2, href: ROUTES.SETTLEMENT_PAYOUTS, periods: [], defaultPeriod: null, narrowTall: true },
  PURCHASE_LIST: { title: '구매목록 남은 품목', adminOnly: true, minW: 1, minH: 1, initW: 1, initH: 1, narrowMinW: 1, narrowInitW: 1, href: ROUTES.PURCHASE_LIST, periods: [], defaultPeriod: null },
  RESERVED_SHIPMENTS: { title: '예약 발송', adminOnly: true, minW: 2, minH: 1, initW: 2, initH: 1, narrowMinW: 2, narrowInitW: 2, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  DAILY_SALES_CHART: { title: '날짜별 매출 · 주문 수', adminOnly: true, minW: 4, minH: 1, initW: 4, initH: 2, narrowMinW: 2, narrowInitW: 2, href: ROUTES.SALES_SUMMARY, periods: ['DAYS_7', 'THIS_MONTH', 'LAST_MONTH'], defaultPeriod: 'DAYS_7', narrowTall: true },
  CHANNEL_SALES_CHART: { title: '채널별 매출', adminOnly: true, minW: 4, minH: 2, initW: 4, initH: 2, narrowMinW: 2, narrowInitW: 2, href: ROUTES.SALES_BY_CHANNEL, periods: ['DAYS_7', 'THIS_MONTH', 'LAST_MONTH'], defaultPeriod: 'DAYS_7', narrowTall: true },
};

/** Picker and selector labels of the periods (D22 · D23). */
export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  TODAY: '오늘',
  DAYS_7: '최근 7일',
  DAYS_30: '최근 30일',
  THIS_MONTH: '이번 달',
  LAST_MONTH: '지난 달',
};

/** Widths the card may take: the D7 widths at or above its minimum. */
export function allowedWidths(type: DashboardCardType): number[] {
  return WEB_GRID.widths.filter((w) => w >= DASHBOARD_CARD_SPECS[type].minW);
}

/** Widths the card may take below 768px: the `NARROW_GRID` widths at or above its narrow minimum (FEATURE_2610_31 D17). */
export function narrowAllowedWidths(type: DashboardCardType): number[] {
  return NARROW_GRID.widths.filter((w) => w >= DASHBOARD_CARD_SPECS[type].narrowMinW);
}

/** Height in px the card is drawn at below 768px. */
export function narrowHeight(type: DashboardCardType): number {
  return DASHBOARD_CARD_SPECS[type].narrowTall ? NARROW_GRID.tallHeight : NARROW_GRID.rowHeight;
}

/** Heights the card may take: the D7 heights at or above its minimum. */
export function allowedHeights(type: DashboardCardType): number[] {
  return WEB_GRID.heights.filter((h) => h >= DASHBOARD_CARD_SPECS[type].minH);
}

/**
 * A stored 「최근 30일」 is 「이번 달」 when the card offers 「이번 달」 (FEATURE_2610_30 D33); otherwise the stored period
 * when the card offers it, else the card's default period; null = the card has no period.
 */
export function effectivePeriod(type: DashboardCardType, period: DashboardPeriod | null): DashboardPeriod | null {
  const spec = DASHBOARD_CARD_SPECS[type];
  if (period === 'DAYS_30' && spec.periods.includes('THIS_MONTH')) return 'THIS_MONTH';
  return period !== null && spec.periods.includes(period) ? period : spec.defaultPeriod;
}
