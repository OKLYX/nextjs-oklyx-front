import type {
  PayoutDetail,
  PayoutQuery,
  PayoutSummary,
  RecognitionPayoutQuery,
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
  /** 지급 묶음 목록 — <b>지급일</b> 축. `lineCount === 0` 인 묶음도 그대로 내려온다(정상, D5-4). */
  getPayouts(query: PayoutQuery): Promise<PayoutSummary[]>;
  /**
   * 지급 묶음 목록 — <b>매출인식월</b> 축 (FEATURE_2609_34). 매출 화면이 판매자를 펼칠 때 1회 부른다.
   *
   * 🔴 채널마다 부르지 않는다 — 판매자 단위로 한 번 받아 화면에서 채널×월로 나눈다.
   */
  getPayoutsByRecognition(query: RecognitionPayoutQuery): Promise<PayoutSummary[]>;
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
   * 🔴 마켓 호출. 주 1회 스케줄이 기본이고 이 버튼은 수동 보정용이다.
   *
   * `month`('yyyy-MM')를 주면 그 달만 읽고 <b>마지막 갱신 앵커를 건드리지 않는다</b>
   * (백엔드 2609_31 / 01 · PLAN 2609_31 D3) — 과거 달 백필이 초기 백필 기회를 소진하지 않는다.
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
}
