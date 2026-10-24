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

import { platformName } from '@/config/platforms';

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
  /**
   * Scheduled payout date (11st: the remittance date). 🔴 Whether and when the money arrived is judged by `status` +
   * `finalSettlementDate ?? settlementDate` (FEATURE_2610_20 / D38).
   */
  settlementDate: string | null;
  /**
   * The date the money actually arrived — filled only when a person marks an 11st payout 「지급 완료」
   * (FEATURE_2610_20 / D38). 🔴 Coupang's payment-history API never sends it (checked against the docs 2026-09-11),
   * so it is always null on Coupang payouts. Show a date as `finalSettlementDate ?? settlementDate` — reading this
   * field alone leaves the cell empty forever.
   */
  finalSettlementDate: string | null;
  totalSale: number | null;
  serviceFee: number | null;
  finalAmount: number | null;
  /** SCHEDULED · PAID · UNKNOWN. */
  status: string | null;
  /** PENDING · RECONCILED · UNRECONCILED · AMOUNT_ONLY · NO_TOTAL (11st, FEATURE_2610_20 / D29). */
  reconStatus: string | null;
  /** 🔴 0 이 정상일 수 있다 — 유보금 해제·채무 상환·광고비 정산은 판매 라인이 없다(D5-4). */
  lineCount: number;
  /**
   * FEATURE_2610_20 / D40: an 11st payout still scheduled after its remittance date (server, KST) — shown as
   * 「입금 확인 필요」 instead of 「예정」. Display only; `status` stays `SCHEDULED`.
   */
  paymentCheckNeeded: boolean;
}

/**
 * One 11st server-fee link waiting for the first-month answer. `GET /api/admin/settlement/first-month-questions`
 * (FEATURE_2610_20 / D45 ⑦)
 */
export interface FirstMonthQuestion {
  linkId: number;
  accountId: number;
  accountAlias: string | null;
  sellerName: string | null;
  /** M0, `yyyy-MM`. */
  firstMonth: string;
  /** The month asked about = M0's previous month, `yyyy-MM`. */
  askMonth: string;
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
  /** 실정산 − 예상(통장 기준: + 면 더 받음). 미분류 라인은 추정 자체가 불가능해 null 이다. */
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

/**
 * 인식월 단위 참고 대조 (FEATURE_2609_32 / PLAN 2609_32 D4·D4-1·D6·D8).
 *
 * 🔴 지급 건 단위 검증식이 아니다. 우리 축은 라인의 인식일(달력 월), 쿠팡 축은 지급 건의 인식월이라
 * 완전히 같지 않다 — `diff` 가 0이 아니어도 정상일 수 있는 <b>참고 지표</b>다. 경고색을 쓰지 않는다.
 * 🔴 `ourLineCount === 0` = 그 달 매출내역 미적재. 서버는 `diff` 를 그대로 담아 보내지만
 *    <b>화면이 숨긴다</b>(D4-1) — 0원을 우리 집계인 척 보여주면 방금 지운 −전액이 부활한다.
 * 🔴 대조 불가 유형(AMOUNT_ONLY)에서만 내려온다. 주정산·월정산이면 `null` 이다.
 */
export interface MonthCheck {
  revenueRecognitionMonth: string | null;
  ourLineTotal: number | null;
  /** 그 달 라인 건수. 0 이면 미적재다(D4-1). */
  ourLineCount: number;
  payoutTotal: number | null;
  /** `ourLineTotal − payoutTotal`. 양수 = 우리가 더 크게 봤다. */
  diff: number | null;
  payoutCount: number;
  /** 지급액 미수신 건 수. 0이 아니면 화면이 반드시 밝힌다(D6). */
  pendingPayoutCount: number;
}

/** 차이 리포트 2단. `GET /api/admin/settlement/payouts/{id}/report` */
export interface ReconReport {
  payout: PayoutSummary;
  blockA: ReconBlockA;
  blockB: ReconBlockB;
  /** 🔴 대조 불가 유형에서만 채워진다. 주정산·월정산은 `null` 이다(D5). */
  monthCheck: MonthCheck | null;
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

/**
 * 판매월 × 지급일 한 줄 — "그 달 판매가 언제 얼마로 정산됐나". `GET /api/admin/settlement/by-sale-month`
 *
 * 🔴 정산 건 목록과 <b>축이 반대</b>다. 저쪽은 정산에서 판매를 내려다보고, 이쪽은 판매에서 정산 시점을
 * 올려다본다 — 한 달 판매가 여러 번에 나눠 정산되면 이 목록에서만 그 갈라짐이 보인다.
 *
 * ⚠️ 아직 어느 정산에도 붙지 않은 판매는 정산 시점이 없어 여기 나오지 않는다.
 */
export interface SaleMonthSettlement {
  /** `yyyy-MM`. */
  saleMonth: string;
  settlementDate: string | null;
  /** 지급 완료 여부. 같은 달이라도 일부만 지급됐을 수 있다. */
  paid: boolean;
  orders: number;
  saleAmount: number;
  /** 🔴 환불 건은 음수로 반영돼 있다. */
  settlementAmount: number;
}

/** 판매월 기준 조회 파라미터. 🔴 채널·기간 모두 필수(서버 400). */
export interface SaleMonthQuery {
  accountId: number;
  from: string;
  to: string;
}

/**
 * <b>매출인식월</b> 축 조회 파라미터 (FEATURE_2609_34). 매출 화면이 "이 기간 매출에 대한 정산"을 뽑을 때 쓴다.
 *
 * 🔴 {@link PayoutQuery} 와 축이 다르다 — 저쪽 `from`/`to` 는 <b>지급일</b>, 이쪽은 <b>판매일</b>이고
 * 서버가 그 기간이 걸치는 인식월 구간으로 바꿔 조회한다. 8월에 판 것을 9월에 받는 건이 있어서, 축을
 * 섞으면 8월 매출 옆에 그 정산이 안 뜬다. 두 파라미터 타입을 합치지 말 것.
 *
 * ⚠️ `from`/`to` 는 <b>필수</b>다(서버에서 400).
 */
export interface RecognitionPayoutQuery {
  sellerId?: number;
  accountId?: number;
  /** 판매일 기준 `yyyy-MM-dd`. */
  from: string;
  to: string;
}

/** 라인 목록 조회 파라미터. 서버가 필터링한다 — 화면에서 다시 거르지 않는다. */
export interface ReconLineQuery {
  label?: string;
  unmatched?: boolean;
}

/**
 * This month's payouts summed across channels (one seller or every seller) — `GET /api/admin/settlement/month-summary`
 * (FEATURE_2610_29 D26 · D30). The server picks this month in KST; a payout belongs to the month of its confirmed
 * payout date, else its scheduled payout date.
 *
 * 🔴 Not the {@link PayoutQuery} axis (the scheduled payout date) — do not rebuild this from `getPayouts`.
 */
export interface SettlementMonthSummary {
  /** 「이번 달 지급 예정 총액」 */
  total: number;
  /** 「지금까지 지급된 금액」 — the `PAID` part of `total`. */
  paid: number;
  /** 「남은 지급 예정 금액」 = `total − paid`. */
  remaining: number;
}

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

/**
 * The detail notice of an 11st payout (`reconStatus === 'NO_TOTAL'`, FEATURE_2610_20 / D29). Not a warning — gray.
 */
export const NO_TOTAL_NOTICE =
  '11번가는 입금 총액을 따로 주지 않아 맞춰 볼 수 없습니다. 금액은 11번가가 알려 준 정산 예정 금액의 합입니다.';

/** 모르는 코드는 원문 그대로 — 두 번째 마켓이나 새 enum 이 붙어도 화면이 빈칸이 되지 않는다. */
const label = (dictionary: Record<string, string>, code: string | null | undefined): string =>
  code == null || code === '' ? '—' : (dictionary[code] ?? code);

export const platformLabel = (platform: string | null): string =>
  platform == null || platform === '' ? '—' : platformName(platform);

/**
 * Market name in a sentence (FEATURE_2610_20 / D14): the platform's name, or 「마켓」 when no channel is chosen
 * (`null`) or the platform has no name.
 */
export const marketName = (platform: string | null | undefined): string =>
  platform != null && platformName(platform) !== platform ? platformName(platform) : '마켓';

/** Whether the last Hangul syllable has a final consonant (decides 「이/가」 · 「을/를」). */
const endsWithFinalConsonant = (word: string): boolean => {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};

/** 「쿠팡」 → 「쿠팡이」, 「11번가」 → 「11번가가」, 「마켓」 → 「마켓이」. */
export const withSubjectParticle = (word: string): string =>
  `${word}${endsWithFinalConsonant(word) ? '이' : '가'}`;

/** 「쿠팡」 → 「쿠팡을」, 「11번가」 → 「11번가를」, 「마켓」 → 「마켓을」. */
export const withObjectParticle = (word: string): string =>
  `${word}${endsWithFinalConsonant(word) ? '을' : '를'}`;
export const settlementTypeLabel = (type: string | null): string => label(SETTLEMENT_TYPE_LABELS, type);
export const payoutStatusLabel = (status: string | null): string => label(PAYOUT_STATUS_LABELS, status);

/** The payout status as shown: 「입금 확인 필요」 when the server flags it (D40), otherwise {@link payoutStatusLabel}. */
export const payoutStatusText = (row: Pick<PayoutSummary, 'status' | 'paymentCheckNeeded'>): string =>
  row.paymentCheckNeeded ? '입금 확인 필요' : payoutStatusLabel(row.status);

/** Today in KST as `yyyy-MM-dd` — the last day an 11st arrival date may take (FEATURE_2610_20 / D38). */
export const todayKst = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

/** The 「실제 입금일」 starting value: the remittance date, or today (KST) when that is still ahead (D38). */
export const defaultPaidOn = (settlementDate: string | null, today: string = todayKst()): string =>
  settlementDate == null || settlementDate > today ? today : settlementDate;
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

/** `2026-09-15T10:20:30` → `09-15 10:20`. 갱신 가능 시각 안내에 쓴다. */
export const formatDateTime = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `yyyy-MM-dd` 조립용. 🔴 `toISOString()` 은 KST 에서 하루 밀린다 — 절대 쓰지 않는다. */
const pad2 = (n: number): string => `${n}`.padStart(2, '0');

/** `Date` → 로컬(KST) 기준 `yyyy-MM-dd`. UTC 변환을 거치지 않는다. */
const toLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * 백필용 월 옵션 (FEATURE_2609_31 / PLAN 2609_31 D4).
 *
 * 최근 12개월(당월 포함), 최신이 위. `value = 'yyyy-MM'` · `label = '2026년 9월'`.
 *
 * ⚠️ 주문의 `buildPeriodOptions`(OrderPeriod.ts)를 재사용하지 않는다 — 그쪽은 `최근 2주` 옵션과
 * `(데이터 없음)` 라벨이 섞여 있어 정산 백필의 선택지로 쓰면 안 되는 값이 들어온다.
 */
export const buildSettlementMonthOptions = (
  months = 12,
  today: Date = new Date()
): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < months; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`,
      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    });
  }
  return options;
};

/**
 * `'yyyy-MM'` → that month's `[from, to]` (`yyyy-MM-dd`) (FEATURE_2609_31 / PLAN 2609_31 D5 · D10).
 *
 * 🔴 `to` <b>never passes today (KST)</b> — the adapters have no clamp, so a future recognition date would go to the
 * market (Coupang · 11st) as is.
 * 🔴 The date is built from `getFullYear()/getMonth()/getDate()` (no `toISOString()` — it shifts a day in KST).
 */
export const monthRange = (
  month: string,
  today: Date = new Date()
): { from: string; to: string } => {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate(); // day 0 of next month = last day
  const from = `${year}-${pad2(monthNumber)}-01`;
  const lastDate = `${year}-${pad2(monthNumber)}-${pad2(lastDay)}`;
  const todayDate = toLocalDate(today);
  // 문자열 비교로 클램프한다(`yyyy-MM-dd` 는 사전순 = 시간순).
  return { from, to: lastDate > todayDate ? todayDate : lastDate };
};

/** `'yyyy-MM'` → `'2026년 9월'`. 진행률·결과 문구에서 쓴다. */
export const monthLabel = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  return year && monthNumber ? `${year}년 ${monthNumber}월` : month;
};

/**
 * `fromMonth`..`toMonth` 오름차순 월 목록 (`yyyy-MM` 문자열 비교로 만든다).
 * 역순 구간이면 빈 배열이다 — 호출부가 [불러오기] 를 막는다.
 */
export const monthsBetween = (fromMonth: string, toMonth: string): string[] => {
  if (!fromMonth || !toMonth || fromMonth > toMonth) return [];
  const [year, monthNumber] = fromMonth.split('-').map(Number);
  const months: string[] = [];
  // 최근 12개월 옵션에서 고르므로 상한 24회면 충분하다 — 잘못된 입력에도 무한 루프가 되지 않는다.
  for (let step = 0; step < 24; step += 1) {
    const cursor = new Date(year, monthNumber - 1 + step, 1);
    const value = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`;
    if (value > toMonth) break;
    months.push(value);
  }
  return months;
};
