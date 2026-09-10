import type { SettlementRepository } from '@/domain/repositories/SettlementRepository';
import type {
  PayoutDetail,
  PayoutQuery,
  PayoutSummary,
  PayoutSyncResult,
  ReconLineQuery,
  ReconLineView,
  ReconReport,
  SettlementSyncResult,
  SettlementSyncTarget,
} from '@/domain/entities/Settlement';

/** 정산 유스케이스 (FEATURE_2609_30 / 05). 목록·상세 두 화면이 공유한다. */
export class SettlementUseCase {
  constructor(private repository: SettlementRepository) {}

  async getPayouts(query: PayoutQuery): Promise<PayoutSummary[]> {
    return this.repository.getPayouts(query);
  }

  async getPayout(payoutId: number): Promise<PayoutDetail> {
    return this.repository.getPayout(payoutId);
  }

  async getPayoutLines(payoutId: number, query: ReconLineQuery): Promise<ReconLineView[]> {
    return this.repository.getPayoutLines(payoutId, query);
  }

  async getReport(payoutId: number): Promise<ReconReport> {
    return this.repository.getReport(payoutId);
  }

  async exportReport(payoutId: number): Promise<Blob> {
    return this.repository.exportReport(payoutId);
  }

  async syncSettlement(accountId?: number, sellerId?: number): Promise<SettlementSyncResult> {
    return this.repository.syncSettlement(accountId, sellerId);
  }

  /** `month`('yyyy-MM')를 주면 그 달만 읽는다(앵커 미갱신 — PLAN 2609_31 D3). */
  async syncPayouts(accountId?: number, month?: string): Promise<PayoutSyncResult> {
    return this.repository.syncPayouts(accountId, month);
  }

  /** 매출내역 기간 백필. 호출부가 월 단위로 쪼개 순차 호출한다(PLAN 2609_31 D5). */
  async syncRevenuePeriod(
    accountId: number,
    from: string,
    to: string
  ): Promise<SettlementSyncResult> {
    return this.repository.syncRevenuePeriod(accountId, from, to);
  }

  async getSyncTargets(sellerId?: number): Promise<SettlementSyncTarget[]> {
    return this.repository.getSyncTargets(sellerId);
  }
}
