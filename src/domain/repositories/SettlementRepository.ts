import type {
  FirstMonthQuestion,
  PayoutDetail,
  PayoutQuery,
  PayoutSummary,
  RecognitionPayoutQuery,
  SaleMonthQuery,
  SaleMonthSettlement,
  PayoutSyncResult,
  ReconLineQuery,
  ReconLineView,
  ReconReport,
  SettlementSyncResult,
  SettlementSyncTarget,
} from '@/domain/entities/Settlement';

/**
 * Settlement ledger · amount check API (FEATURE_2609_30 / backend 01 · 02). Every path is `/api/admin/settlement/**`
 * — ADMIN only (PLAN D17).
 *
 * 🔴 <b>Lookups (get*) and refreshes (sync*) are different in kind.</b> Lookups read the local DB and never call the
 * market, but `sync*` calls the market (Coupang · 11st, FEATURE_2610_20). So never call `sync*` on screen entry
 * (mount) — every visit would send market API calls. That is exactly what D11 prevents. The 11st 「지급 완료」 mark
 * and the first-month answer (`markPaid` · `unmarkPaid` · `answerFirstMonth`) only write local rows.
 */
export interface SettlementRepository {
  /** 지급 묶음 목록 — <b>지급일</b> 축. `lineCount === 0` 인 묶음도 그대로 내려온다(정상, D5-4). */
  getPayouts(query: PayoutQuery): Promise<PayoutSummary[]>;
  /**
   * 지급 묶음 목록 — <b>매출인식월</b> 축 (FEATURE_2609_34). 매출 화면이 판매자를 펼칠 때 1회 부른다.
   *
   * 🔴 채널마다 부르지 않는다 — 판매자 단위로 한 번 받아 화면에서 채널×월로 나눈다.
   */
  getPayoutsByRecognition(query: RecognitionPayoutQuery): Promise<PayoutSummary[]>;
  /**
   * 판매월 기준 정산 — "그 달 판매가 언제 정산됐나". 🔴 위 두 목록과 축이 반대다(판매 → 정산).
   */
  getSaleMonthSettlements(query: SaleMonthQuery): Promise<SaleMonthSettlement[]>;
  /** 묶음 1건 + 조정 + 검증식 요약. 리포트가 필요한 화면은 `getReport` 를 쓴다(같은 값을 포함한다). */
  getPayout(payoutId: number): Promise<PayoutDetail>;
  /** 라벨·미분류 필터는 <b>서버가</b> 적용한다. */
  getPayoutLines(payoutId: number, query: ReconLineQuery): Promise<ReconLineView[]>;
  /** 차이 리포트 2단 (D12). */
  getReport(payoutId: number): Promise<ReconReport>;
  /** 리포트 라인 xlsx. JSON 봉투가 아니라 blob 이다. */
  exportReport(payoutId: number): Promise<Blob>;
  /** 🔴 마켓 호출. 사용자가 [갱신] 을 누를 때만 부른다. */
  syncSettlement(accountId?: number, sellerId?: number): Promise<SettlementSyncResult>;
  /**
   * 🔴 Market call — except 11st, whose payouts are rebuilt from the stored lines with no market call
   * (FEATURE_2610_20 / D30). A weekly schedule is the default; this button is a manual correction.
   *
   * With `month` ('yyyy-MM') only that month is read and <b>the last-refresh anchor is not touched</b>
   * (backend 2609_31 / 01 · PLAN 2609_31 D3) — a past-month backfill does not use up the initial backfill.
   */
  syncPayouts(accountId?: number, month?: string): Promise<PayoutSyncResult>;
  /**
   * 🔴 마켓 호출. 매출내역(정산 라인) 기간 백필 — 계정 1건.
   *
   * 한 번에 <b>한 달만</b> 보낸다(PLAN 2609_31 D5). 여러 달을 한 요청에 맡기면 서버가 창을 직렬로
   * 다 돌아 504 가 된다. 이 경로는 앵커를 갱신하지 않는다.
   */
  syncRevenuePeriod(accountId: number, from: string, to: string): Promise<SettlementSyncResult>;
  /** 대상 채널 + 마지막 갱신 시각. 자격증명은 포함되지 않는다. */
  getSyncTargets(sellerId?: number): Promise<SettlementSyncTarget[]>;
  /** 11st 「지급 완료」 — status PAID + the date the money arrived (`yyyy-MM-dd`). Local write only (FEATURE_2610_20 / D34 · D38). */
  markPaid(payoutId: number, paidOn: string): Promise<void>;
  /** 11st 「지급 완료 취소」 — back to scheduled, the arrival date cleared (D39). */
  unmarkPaid(payoutId: number): Promise<void>;
  /** 11st server-fee links waiting for the first-month answer (D45 ⑦). Local read — safe on mount. */
  getFirstMonthQuestions(): Promise<FirstMonthQuestion[]>;
  /** [예] = true · [아니오] = false on one question (D45 ⑦). */
  answerFirstMonth(linkId: number, charged: boolean): Promise<void>;
}
