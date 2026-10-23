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
  PAID_ORDERS: { title: '결제완료 주문 수', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  NEW_ORDERS: { title: '새 주문 수', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  OPEN_CLAIMS: { title: '처리 안 된 반품 · 교환', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, href: ROUTES.ORDERS_CLAIMS, periods: [], defaultPeriod: null },
  UNANSWERED_INQUIRIES: { title: '답 안 한 고객문의', adminOnly: false, minW: 1, minH: 1, initW: 1, initH: 1, href: ROUTES.ORDERS_INQUIRIES, periods: [], defaultPeriod: null },
  PERIOD_SALES: { title: '기간 매출', adminOnly: true, minW: 2, minH: 1, initW: 2, initH: 1, href: ROUTES.SALES_SUMMARY, periods: ['TODAY', 'DAYS_7', 'THIS_MONTH'], defaultPeriod: 'THIS_MONTH' },
  SETTLEMENT_PAYOUTS: { title: '정산 지급', adminOnly: true, minW: 2, minH: 1, initW: 2, initH: 1, href: ROUTES.SETTLEMENT_PAYOUTS, periods: [], defaultPeriod: null },
  PURCHASE_LIST: { title: '구매목록 남은 품목', adminOnly: true, minW: 1, minH: 1, initW: 1, initH: 1, href: ROUTES.PURCHASE_LIST, periods: [], defaultPeriod: null },
  RESERVED_SHIPMENTS: { title: '예약 발송', adminOnly: true, minW: 2, minH: 1, initW: 2, initH: 1, href: ROUTES.ORDERS_SHIPMENT, periods: [], defaultPeriod: null },
  DAILY_SALES_CHART: { title: '날짜별 매출 · 주문 수', adminOnly: true, minW: 4, minH: 1, initW: 4, initH: 2, href: ROUTES.SALES_SUMMARY, periods: ['DAYS_7', 'DAYS_30'], defaultPeriod: 'DAYS_7' },
  CHANNEL_SALES_CHART: { title: '채널별 매출', adminOnly: true, minW: 4, minH: 1, initW: 4, initH: 2, href: ROUTES.SALES_BY_CHANNEL, periods: ['DAYS_7', 'DAYS_30'], defaultPeriod: 'DAYS_7' },
};

/** Picker and selector labels of the periods (D22 · D23). */
export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  TODAY: '오늘',
  DAYS_7: '최근 7일',
  DAYS_30: '최근 30일',
  THIS_MONTH: '이번 달',
};

/** Widths the card may take: the D7 widths at or above its minimum. */
export function allowedWidths(type: DashboardCardType): number[] {
  return WEB_GRID.widths.filter((w) => w >= DASHBOARD_CARD_SPECS[type].minW);
}

/** Heights the card may take: the D7 heights at or above its minimum. */
export function allowedHeights(type: DashboardCardType): number[] {
  return WEB_GRID.heights.filter((h) => h >= DASHBOARD_CARD_SPECS[type].minH);
}

/** The stored period when the card offers it, otherwise the card's default period; null = the card has no period. */
export function effectivePeriod(type: DashboardCardType, period: DashboardPeriod | null): DashboardPeriod | null {
  const spec = DASHBOARD_CARD_SPECS[type];
  return period !== null && spec.periods.includes(period) ? period : spec.defaultPeriod;
}
