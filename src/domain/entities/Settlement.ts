/**
 * 정산 원장 · 금액 확인 (FEATURE_2609_30 / PLAN D3 · D5 · D9 · D12 · D13, 백엔드 02 SSOT).
 *
 * 🔴 <b>금액은 서버가 계산한 값을 그대로 쓴다.</b> 화면에서 다시 더하면 검증식이 서버와 다른 답을 내고,
 * 그 순간 금액 확인 화면 전체가 신뢰를 잃는다(백엔드 `SettlementReconciler` 가 단일 소유자다).
 *
 * 🔴 <b>문구를 프론트가 지어내지 않는다</b>(D13). 차감 사유는 쿠팡이 주지 않으므로 서버가 `guidance` 로
 * 내려준다. 그 문구가 곧 사용자의 문의 트리거다 — 그럴듯한 추측으로 대체하면 리포트가 거짓말을 시작한다.
 *
 * ⚠️ 이 화면의 축은 <b>채널(marketplaceAccount)</b> 이다. 판매자는 표기·필터용이며 정산은 vendorId
 * 단위로 온다(D3). 매출(판매일 축)은 이 파일이 아니라 `SalesSummary.ts` 다.
 */

/** 지급 묶음 1건의 요약. `GET /api/admin/settlement/payouts` */
export interface PayoutSummary {
  payoutId: number;
  accountId: number | null;
  platform: string | null;
  accountAlias: string | null;
  sellerId: number | null;
  sellerName: string | null;
  /** WEEKLY · MONTHLY · ADDITIONAL · RESERVE · DAILY · UNKNOWN (D5-3). */
  settlementType: string | null;
  revenueRecognitionMonth: string | null;
  recognitionFrom: string | null;
  recognitionTo: string | null;
  settlementDate: string | null;
  finalSettlementDate: string | null;
  totalSale: number | null;
  serviceFee: number | null;
  finalAmount: number | null;
  /** SCHEDULED · PAID · UNKNOWN. */
  status: string | null;
  /** PENDING · RECONCILED · UNRECONCILED · AMOUNT_ONLY. */
  reconStatus: string | null;
  /** 🔴 0 이 정상일 수 있다 — 유보금 해제·채무 상환·광고비 정산은 판매 라인이 없다(D5-4). */
  lineCount: number;
}

/**
 * 지급 묶음 레벨 조정 1행 (D8).
 *
 * @property amount 플랫폼 원문 값(양수). 부호는 `type` 이 정한다 — {@link adjustmentSign} 참고.
 * @property guidance 서버 소유 문구. null 이 아니면 <b>그대로</b> 출력한다(D13).
 */
export interface AdjustmentView {
  type: string;
  amount: number | null;
  note: string | null;
  guidance: string | null;
}

/** 금액 확인 리포트의 라인 1행. 🔴 문의용 식별자(주문번호·옵션ID·인식일·지급일·정산유형)가 핵심이다. */
export interface ReconLineView {
  externalOrderId: string | null;
  platformOptionId: string | null;
  productName: string | null;
  recognitionDate: string | null;
  settlementDate: string | null;
  settlementType: string | null;
  saleAmount: number | null;
  serviceFee: number | null;
  /** 실측 수수료율(0~1). 기준표(카테고리)와 다르면 그 차이가 `FEE_RATE` 라벨이 된다. */
  serviceFeeRatio: number | null;
  settlementAmount: number | null;
  /** 예상 − 실정산. 미분류 라인은 추정 자체가 불가능해 null 이다. */
  diff: number | null;
  label: string;
  /** 붙일 주문 라인이 없는 상태. <b>정상</b>이며 합계에는 포함된다(D7). */
  unmatched: boolean;
}

/** 차이 리포트 ①의 원인 라벨 1개. 🔴 `Σ amount === totalDiff` (항등식). */
export interface LabelView {
  label: string;
  amount: number | null;
  count: number;
  /** 서버 소유 설명·경고. 있으면 그대로 출력한다. */
  detail: string | null;
}

/** 검증식 `Σ라인 + Σ조정 == finalAmount` 의 전개 (D9). 라인 0건이면 조정만 나열된다 — 정상이다. */
export interface ReconBlockA {
  lineTotal: number | null;
  adjustments: AdjustmentView[];
  adjustmentTotal: number | null;
  ourTotal: number | null;
  finalAmount: number | null;
  /** 우리 계산 − 쿠팡 지급액. 양수 = 우리가 더 크게 봤다. */
  diff: number | null;
  /** 허용오차 = max(10원, 라인당 × 라인 수). |diff| ≤ tolerance 면 일치다. */
  tolerance: number | null;
  unmatchedCount: number;
  reconStatus: string | null;
}

/** 원인 라벨 분해 (D12 상단). `totalDiff = expected − actual` — 양수 = 예상보다 덜 받았다. */
export interface ReconBlockB {
  expected: number | null;
  actual: number | null;
  totalDiff: number | null;
  labels: LabelView[];
}

/** 차이 리포트 2단. `GET /api/admin/settlement/payouts/{id}/report` */
export interface ReconReport {
  payout: PayoutSummary;
  blockA: ReconBlockA;
  blockB: ReconBlockB;
}

/** 묶음 1건 + 조정 + 검증식 요약. `GET /api/admin/settlement/payouts/{id}` */
export interface PayoutDetail {
  payout: PayoutSummary;
  adjustments: AdjustmentView[];
  lineTotal: number | null;
  adjustmentTotal: number | null;
  ourTotal: number | null;
  diff: number | null;
  unmatchedCount: number;
}

/**
 * 매출내역 적재 결과. 🔴 `skipped === true` 는 <b>에러가 아니다</b> — 수동 갱신 최소 간격(기본 10분)에
 * 걸려 마켓을 부르지 않았다는 뜻이다(D11).
 */
export interface SettlementSyncResult {
  accounts: number;
  lines: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  skipped: boolean;
  nextAvailableAt: string | null;
  failedAccounts: string[];
}

/** 지급내역 적재 결과. `attributedLines === 0` 도 정상이다(ADDITIONAL/RESERVE 는 라인을 안 가져간다). */
export interface PayoutSyncResult {
  accounts: number;
  payouts: number;
  attributedLines: number;
  adjustments: number;
  failedAccounts: string[];
}

/** 동기화 대상 채널 1건. 채널 드롭다운과 "마지막 갱신" 표시의 출처다. */
export interface SettlementSyncTarget {
  accountId: number;
  sellerId: number | null;
  sellerName: string | null;
  platform: string | null;
  accountAlias: string | null;
  lastSettlementSyncAt: string | null;
  lastPayoutSyncAt: string | null;
  /** 수동 갱신 최소 간격이 풀리는 시각. null = 지금 갱신 가능. */
  nextAvailableAt: string | null;
}

/** 지급 묶음 목록 조회 파라미터. 빈 값은 아예 보내지 않는다(`from=` 은 400 이 된다). */
export interface PayoutQuery {
  sellerId?: number;
  accountId?: number;
  /** 지급일 기준 `yyyy-MM-dd`. */
  from?: string;
  to?: string;
}

/** 라인 목록 조회 파라미터. 서버가 필터링한다 — 화면에서 다시 거르지 않는다. */
export interface ReconLineQuery {
  label?: string;
  unmatched?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡', NAVER: '네이버' };

const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
  WEEKLY: '주정산',
  MONTHLY: '월정산',
  DAILY: '일정산',
  ADDITIONAL: '추가정산',
  RESERVE: '잔액지급',
  UNKNOWN: '기타',
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '예정',
  PAID: '완료',
  UNKNOWN: '미확인',
};

const ADJUSTMENT_LABELS: Record<string, string> = {
  DEDUCTION: '차감액',
  DEBT_CARRIED: '전주 채무 이월',
  PENDING_RELEASE: '보류 해제 예정액',
  OTHER: '기타 조정',
};

/** 차이 원인 라벨 (백엔드 `SettlementDiffAnalyzer` 상수와 1:1). */
const CAUSE_LABELS: Record<string, string> = {
  FEE_RATE: '수수료율 차이',
  FEE_VAT: '수수료 부가세 차이',
  SELLER_COUPON: '셀러 쿠폰 부담',
  DELIVERY: '배송비',
  REFUND: '환불',
  UNKNOWN_BASE: '수수료 기준 없음',
  ROUNDING: '반올림·기타',
  NONE: '차이 없음',
  UNMATCHED: '미분류',
};

/** 모르는 코드는 원문 그대로 — 두 번째 마켓이나 새 enum 이 붙어도 화면이 빈칸이 되지 않는다. */
const label = (dictionary: Record<string, string>, code: string | null | undefined): string =>
  code == null || code === '' ? '—' : (dictionary[code] ?? code);

export const platformLabel = (platform: string | null): string => label(PLATFORM_LABELS, platform);
export const settlementTypeLabel = (type: string | null): string => label(SETTLEMENT_TYPE_LABELS, type);
export const payoutStatusLabel = (status: string | null): string => label(PAYOUT_STATUS_LABELS, status);
export const adjustmentLabel = (type: string | null): string => label(ADJUSTMENT_LABELS, type);
export const causeLabel = (cause: string | null): string => label(CAUSE_LABELS, cause);

/** 채널 표시명. 별칭이 비어 있으면 주문·매출 화면과 같은 `채널 #12` 표기를 쓴다. */
export const channelLabel = (
  row: Pick<PayoutSummary, 'accountId' | 'accountAlias' | 'platform'>
): string =>
  `${platformLabel(row.platform)} · ${row.accountAlias?.trim() ? row.accountAlias : `채널 #${row.accountId ?? '—'}`}`;

/** 금액 표시. 원 단위 정수로 반올림한다(소수 원은 사용자에게 의미가 없다). */
export const formatMoney = (value: number | null | undefined): string =>
  value == null ? '—' : Math.round(value).toLocaleString('ko-KR');

/** 부호를 붙인 금액. 0 은 부호 없이 그대로 둔다. */
export const formatSigned = (value: number | null | undefined): string => {
  if (value == null) return '—';
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded.toLocaleString('ko-KR')}` : rounded.toLocaleString('ko-KR');
};

/** 실측 수수료율(0~1) → `11.5%`. */
export const formatRatio = (value: number | null | undefined): string =>
  value == null ? '—' : `${(value * 100).toFixed(1)}%`;

/**
 * 조정 행의 부호 (백엔드 `SettlementReconciler.signedAmount` 와 같은 규칙).
 *
 * 🔴 `PENDING_RELEASE`·`OTHER` 는 <b>0</b> 이다 — 이번 지급액이 아니라 정보성이라 검증식 합산에서 빠진다.
 * 화면에서 더하면 서버 합계와 어긋난다.
 */
export const adjustmentSign = (type: string | null): -1 | 0 => (
  type === 'DEDUCTION' || type === 'DEBT_CARRIED' ? -1 : 0
);

/** 검증식 합산에서 빠지는 정보성 조정인가. 표에 "합계 제외" 라벨을 다는 근거다. */
export const isInformationalAdjustment = (type: string | null): boolean => adjustmentSign(type) === 0;

/** `yyyy-MM-dd` 두 개를 `09-01 ~ 09-07` 로. 값이 없으면 `—`. */
export const formatDateRange = (from: string | null, to: string | null): string => {
  const short = (value: string | null) => (value ? value.slice(5) : '—');
  return from == null && to == null ? '—' : `${short(from)} ~ ${short(to)}`;
};

/** `2026-09-15T10:20:30` → `3시간 전`. 이력이 없으면 `없음`. */
export const formatRelativeTime = (value: string | null): string => {
  if (!value) return '없음';
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '없음';
  const minutes = Math.floor((Date.now() - target) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
};

/** `2026-09-15T10:20:30` → `09-15 10:20`. 갱신 가능 시각 안내에 쓴다. */
export const formatDateTime = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
