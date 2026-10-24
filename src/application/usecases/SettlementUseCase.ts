import type { SettlementRepository } from '@/domain/repositories/SettlementRepository';
import type {
  FirstMonthQuestion,
  PayoutDetail,
  PayoutQuery,
  PayoutSummary,
  PayoutSyncResult,
  RecognitionPayoutQuery,
  SaleMonthQuery,
  SaleMonthSettlement,
  ReconLineQuery,
  ReconLineView,
  ReconReport,
  SettlementMonthSummary,
  SettlementSyncResult,
  SettlementSyncTarget,
} from '@/domain/entities/Settlement';

/**
 * Settlement use case (FEATURE_2609_30 / 05). Shared by the payout list, the payout detail, the sales screen and the
 * dashboard payout card (FEATURE_2610_29).
 */
export class SettlementUseCase {
  constructor(private repository: SettlementRepository) {}

  async getPayouts(query: PayoutQuery): Promise<PayoutSummary[]> {
    return this.repository.getPayouts(query);
  }

  /** 매출인식월 축 — 매출 화면 전용(FEATURE_2609_34). 지급일 축인 `getPayouts` 와 섞지 말 것. */
  async getPayoutsByRecognition(query: RecognitionPayoutQuery): Promise<PayoutSummary[]> {
    return this.repository.getPayoutsByRecognition(query);
  }

  /** 판매월 기준 정산 — 정산 건 목록과 축이 반대다(판매 → 정산). */
  async getSaleMonthSettlements(query: SaleMonthQuery): Promise<SaleMonthSettlement[]> {
    return this.repository.getSaleMonthSettlements(query);
  }

  /** This month's payout sums — the dashboard payout card (FEATURE_2610_29 D30). */
  async getMonthSummary(sellerId?: number): Promise<SettlementMonthSummary> {
    return this.repository.getMonthSummary(sellerId);
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

  /** 11st 「지급 완료」 (FEATURE_2610_20 / D34 · D38). `paidOn` = `yyyy-MM-dd`. */
  async markPaid(payoutId: number, paidOn: string): Promise<void> {
    return this.repository.markPaid(payoutId, paidOn);
  }

  /** 11st 「지급 완료 취소」 (D39). */
  async unmarkPaid(payoutId: number): Promise<void> {
    return this.repository.unmarkPaid(payoutId);
  }

  /** 11st server-fee first-month questions (D45 ⑦). */
  async getFirstMonthQuestions(): Promise<FirstMonthQuestion[]> {
    return this.repository.getFirstMonthQuestions();
  }

  async answerFirstMonth(linkId: number, charged: boolean): Promise<void> {
    return this.repository.answerFirstMonth(linkId, charged);
  }
}
