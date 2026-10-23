/**
 * Dashboard cards of the logged-in member (GET /api/dashboard/layout, FEATURE_2610_29 D6 · D8 · D11).
 *
 * 🔴 The card list and each card's period are shared by web and mobile; the place and size are stored per platform
 * (D11). A platform's fields are null until that platform saves the card.
 */

/** The cards a dashboard can show — the backend `DashboardCardType`, in the D8 order. */
export type DashboardCardType =
  | 'PAID_ORDERS'
  | 'NEW_ORDERS'
  | 'OPEN_CLAIMS'
  | 'UNANSWERED_INQUIRIES'
  | 'PERIOD_SALES'
  | 'SETTLEMENT_PAYOUTS'
  | 'PURCHASE_LIST'
  | 'RESERVED_SHIPMENTS'
  | 'DAILY_SALES_CHART'
  | 'CHANNEL_SALES_CHART';

/** Period a card reads — the backend `DashboardPeriod` (D22 · D23). */
export type DashboardPeriod = 'TODAY' | 'DAYS_7' | 'DAYS_30' | 'THIS_MONTH';

/** One stored card. */
export interface DashboardCardSetting {
  cardType: DashboardCardType;
  /** null = the card's first period, or the card has no period. */
  period: DashboardPeriod | null;
  webX: number | null;
  webY: number | null;
  webW: number | null;
  webH: number | null;
  mobileOrder: number | null;
  mobileW: number | null;
}

export interface DashboardLayout {
  /** true = ADMIN — the admin cards are shown then (D9). */
  admin: boolean;
  /** false = not saved yet; `cards` is empty and the screen draws the default cards (D19). */
  saved: boolean;
  cards: DashboardCardSetting[];
}

/** One card of PUT /api/dashboard/layout/web — place and size in grid cells. */
export interface DashboardWebCard {
  cardType: DashboardCardType;
  period: DashboardPeriod | null;
  x: number;
  y: number;
  w: number;
  h: number;
}
