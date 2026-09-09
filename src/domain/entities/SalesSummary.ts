/**
 * 매출 집계 (FEATURE_2609_30 / PLAN D2 · D3 · D4 · D14 · D15, 백엔드 03 SSOT).
 *
 * 🔴 <b>축이 둘 섞여 있다.</b> `grossSales`/`discount`/`estFee`/`estNetProfit` 은 <b>판매일</b> 축의 기간
 * 합계이고, `pendingPayout`("정산 예정 금액")은 <b>매출인식일</b> 축의 <b>기간 무관</b> 총액이다(D4).
 * 화면은 기간을 바꿔도 안 변하는 이 값에 반드시 `기간 무관 · 미지급 잔액` 라벨을 붙인다 —
 * 라벨이 없으면 버그로 오해받는다.
 *
 * 🔴 `estNetProfit === null`(= `costBasisReady === false`)은 <b>"아직 모른다"</b>는 뜻이다.
 * 0 으로 그리지 않는다 — 0 은 "안 남았다"는 뜻이라 정반대다(D15).
 *
 * ⚠️ 이 화면은 정산 배치·금액 확인을 다루지 않는다. 그쪽 진입점은 `ROUTES.SETTLEMENT_PAYOUTS` 뿐이다.
 */

/** ① 판매자별 요약 한 줄. `GET /api/admin/sales/summary` */
export interface SellerSales {
  sellerId: number;
  sellerName: string;
  grossSales: number;
  /** 🔴 매출에서 빼지 않은 값이다(부담 주체를 확정하는 것은 정산 API 다). 별도 컬럼으로만 보여준다. */
  discount: number;
  netQty: number;
  /** 환불대기 수량. 유효수량에서 빼지 않는다(D14) — 별도 표기다. */
  holdQty: number;
  estFee: number;
  /** 원가 스냅샷이 없는 라인이 하나라도 섞이면 null (D15). */
  estNetProfit: number | null;
  costBasisReady: boolean;
  /** 🔴 기간 무관 "정산 예정 금액". 기간 필터와 함께 묶어 라벨링하지 말 것(D4). */
  pendingPayout: number;
  unreconciledPayouts: number;
}

/** ② 채널(계정)별 한 줄. `GET /api/admin/sales/by-channel` */
export interface ChannelSales {
  accountId: number;
  accountAlias: string | null;
  platform: string;
  sellerId: number;
  grossSales: number;
  discount: number;
  netQty: number;
  holdQty: number;
  estFee: number;
  estNetProfit: number | null;
  costBasisReady: boolean;
  pendingPayout: number;
  /** 현금주의(지급 확정). 🔴 채널에만 있다 — 정산 주기가 채널마다 달라 판매자 합산은 뜻을 잃는다(D4-1). */
  paidAmount: number;
  lastSettlementSyncAt: string | null;
  unreconciledPayouts: number;
  /** 라인 없이 금액만 있는 묶음 수(추가정산·유보금). 0 이 아닌 것이 정상이다(D5-5). */
  amountOnlyPayouts: number;
  /**
   * 🔴 전체 지급 묶음 수. <b>0 = 정산 이력 없음</b>.
   *
   * 이 값 없이 `unreconciledPayouts === 0` 만 보면 "전부 금액이 맞음"과 "아직 정산이 안 들어옴"이
   * 같은 초록 배지가 된다. 정산 전 채널이 훨씬 흔하므로 그 오해가 기본값이 되어 버린다.
   */
  payoutCount: number;
}

/** ③ 상품별 수익성 한 줄. `GET /api/admin/sales/by-product` */
export interface ProductProfit {
  /** `uncategorized === true` 면 null. */
  masterProductId: number | null;
  masterProductName: string;
  /** `crossChannel === true` 면 null(별칭도 함께 null). */
  accountId: number | null;
  accountAlias: string | null;
  netQty: number;
  grossSales: number;
  discount: number;
  estFee: number;
  estNetProfit: number | null;
  costBasisReady: boolean;
  /** 채널 옵션 연결이 없는 주문. 🔴 숨기지 않는다 — 숨기면 합계가 안 맞는 이유를 아무도 모른다. */
  uncategorized: boolean;
}

const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡', NAVER: '네이버' };

/** 알 수 없는 코드는 원문 그대로 — 두 번째 마켓이 붙어도 화면이 빈칸이 되지 않는다. */
export const platformLabel = (platform: string): string => PLATFORM_LABELS[platform] ?? platform;

/** 채널 표시명. 별칭이 비어 있으면 주문 화면과 같은 `채널 #12` 표기를 쓴다. */
export const channelLabel = (row: Pick<ChannelSales, 'accountId' | 'accountAlias' | 'platform'>): string =>
  `${platformLabel(row.platform)} · ${row.accountAlias?.trim() ? row.accountAlias : `채널 #${row.accountId}`}`;

/** 금액 표시. 원 단위 정수로 반올림한다(소수 원은 사용자에게 의미가 없다). */
export const formatMoney = (value: number | null | undefined): string =>
  value == null ? '—' : Math.round(value).toLocaleString('ko-KR');

/**
 * 순이익 표시. 🔴 `costBasisReady === false` 면 `—` 다. 0 으로 대체하지 말 것(D15).
 */
export const formatProfit = (row: { estNetProfit: number | null; costBasisReady: boolean }): string =>
  row.costBasisReady && row.estNetProfit != null ? formatMoney(row.estNetProfit) : '—';

/** 순이익이 비어 있는 이유를 셀 툴팁으로 설명한다(헤더 툴팁만으론 행마다 다른 상태를 못 보여준다). */
export const PROFIT_PENDING_HINT = '원가 스냅샷 준비 후 표시됩니다';
