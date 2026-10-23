import type { DashboardLayout, DashboardWebCard } from '@/domain/entities/DashboardEntity';

/** Dashboard of the logged-in member (FEATURE_2610_29 D6 · D11). USER · GUEST · ADMIN may call it. */
export interface DashboardRepository {
  getLayout(): Promise<DashboardLayout>;
  /** Replaces the card list with the web cards; a stored card missing here is removed on mobile too (D11). */
  saveWebLayout(cards: DashboardWebCard[]): Promise<DashboardLayout>;
}
