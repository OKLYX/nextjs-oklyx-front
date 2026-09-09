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

/**
 * 정산 원장·금액 확인 API (FEATURE_2609_30 / 백엔드 01·02). 전 경로가 `/api/admin/settlement/**` —
 * ADMIN 전용(PLAN D17).
 *
 * 🔴 <b>조회(get*)와 갱신(sync*)은 성격이 다르다.</b> 조회는 전부 로컬 DB 라 마켓을 부르지 않지만,
 * `sync*` 는 쿠팡을 호출한다. 그래서 화면 진입(마운트)에서 `sync*` 를 부르면 안 된다 — 사용자가 화면을
 * 열 때마다 마켓 API 호출이 나간다. D11 이 막으려는 것이 정확히 이것이다.
 */
export interface SettlementRepository {
  /** 지급 묶음 목록. `lineCount === 0` 인 묶음도 그대로 내려온다(정상, D5-4). */
  getPayouts(query: PayoutQuery): Promise<PayoutSummary[]>;
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
  /** 🔴 마켓 호출. 주 1회 스케줄이 기본이고 이 버튼은 수동 보정용이다. */
  syncPayouts(accountId?: number): Promise<PayoutSyncResult>;
  /** 대상 채널 + 마지막 갱신 시각. 자격증명은 포함되지 않는다. */
  getSyncTargets(sellerId?: number): Promise<SettlementSyncTarget[]>;
}
