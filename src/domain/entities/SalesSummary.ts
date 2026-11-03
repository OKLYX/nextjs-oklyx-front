/**
 * Sales aggregates (FEATURE_2609_30 / PLAN D2 · D3 · D4 · D14 · D15, backend 03 SSOT).
 *
 * 🔴 The sales amounts here are <b>sale-date</b> sums of the period — `estSettlement` (「정산 추정 금액」) too
 * (FEATURE_2611_05 D2 · D6). `ChannelSales.paidAmount` is the one cash-basis value (paid in the period). The money
 * still to be received regardless of the period is no longer sent (D9 · D13).
 *
 * 🔴 <b>Reconciliation status counts (amount mismatch N) are not in this response</b> (FEATURE_2609_34). Payouts are
 * on the revenue-recognition axis, so narrowing the period does not change the count, and as a badge on a row with a
 * period filter it reads as "N mismatched this month" (it was the channel's whole count). Reconciliation status is
 * shown per payout by the recognition-month list under an opened channel — do not bring the badge back.
 *
 * 🔴 `estNetProfit === null` (= `costBasisReady === false`) means <b>"not known yet"</b>. Never draw it as 0 — 0 means
 * "nothing left", the opposite (D15). `estSettlement === null` is the same: unknown, not 0 (FEATURE_2611_05 D7).
 *
 * ⚠️ These screens do not handle payout batches or amount checks. Their entry point is `ROUTES.SETTLEMENT_PAYOUTS`
 * only.
 */

import { platformName } from '@/config/platforms';

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
  /**
   * 「정산 추정 금액」 of the period's sales (FEATURE_2611_05 D12): sales − (discount − platform discount) − estimated fee
   * − `fixedCost`. 🔴 null = some line has no commission base (D7) — shown as `—`, never 0.
   */
  estSettlement: number | null;
  /**
   * 조회 기간에 이 판매자의 채널들이 부담하는 월 고정비 합 (PLAN 2609_33 D4 · D7).
   * 🔴 `estNetProfit` 에는 이미 반영돼 있다 — 화면에서 다시 빼지 않는다.
   * 🔴 순이익이 null(원가 미확정)이어도 이 값은 온다(D6).
   */
  fixedCost: number;
}

/** ② 채널(계정)별 한 줄. `GET /api/admin/sales/by-channel` */
export interface ChannelSales {
  accountId: number;
  accountAlias: string | null;
  platform: string;
  sellerId: number;
  sellerName: string | null;
  grossSales: number;
  discount: number;
  netQty: number;
  holdQty: number;
  estFee: number;
  estNetProfit: number | null;
  costBasisReady: boolean;
  /** 취소 확정 수량. 매출액에서는 이미 빠져 있다. */
  cancelQty: number;
  /** 취소 확정으로 <b>매출에서 빠진</b> 금액("환불완료"). */
  refundedAmount: number;
  /**
   * 아직 매출에 남아 있지만 빠질 수 있는 금액("환불대기").
   * 🔴 서버가 유효수량 상한을 걸어 준 값이다 — 이미 취소 확정된 몫을 다시 세지 않는다.
   */
  pendingRefundAmount: number;
  /** Same as `SellerSales.estSettlement`, for one channel (FEATURE_2611_05 D12). */
  estSettlement: number | null;
  /** 현금주의(지급 확정). 🔴 채널에만 있다 — 정산 주기가 채널마다 달라 판매자 합산은 뜻을 잃는다(D4-1). */
  paidAmount: number;
  lastSettlementSyncAt: string | null;
  /**
   * 조회 기간에 이 채널이 부담하는 월 고정비 합 (PLAN 2609_33 D4 · D7).
   * 🔴 `estNetProfit` 에는 이미 반영돼 있다 — 화면에서 다시 빼지 않는다.
   * 🔴 순이익이 null(원가 미확정)이어도 이 값은 온다(D6).
   */
  fixedCost: number;
  /**
   * 이 기간에 고정비가 실제로 부과된 달 수 (PLAN 2609_33 D2 · D4). 0 = 임계 미달이거나 설정이 없다.
   *
   * ⚠️ 판매자 행(`SellerSales`)에는 없다 — 채널마다 부과된 달이 달라 합칠 수 없는 숫자다(D11-2).
   */
  fixedCostMonths: number;
}

/**
 * ④ 판매 내역 한 줄 — <b>접지 않은 주문 라인</b>. `GET /api/admin/sales/lines`
 *
 * 🔴 ③(상품별)이 <i>무엇이</i> 팔렸는지를 말한다면 이쪽은 <i>어느 주문에서</i> 팔렸는지를 말한다.
 * 마켓 관리자 화면과 대조할 수 있는 유일한 축이라 주문번호를 그대로 싣는다.
 *
 * ⚠️ 금액은 서버가 집계와 <b>같은 식</b>으로 계산해 내려준다 — 화면에서 다시 곱하지 말 것.
 */
export interface SalesLine {
  orderLineId: number;
  accountId: number;
  /** 판매일(결제 시각). */
  orderedAt: string;
  externalOrderId: string;
  /** 주문 당시 채널이 준 옵션명. 마스터 연결이 없어도 이건 있다. */
  itemName: string | null;
  /** 🔴 null = 채널 옵션에 연결되지 않은 주문. 숨기지 않는다 — 숨기면 합계가 어긋난다. */
  masterProductName: string | null;
  orderQty: number;
  cancelQty: number;
  /** 환불대기. 유효수량에서 빼지 않는다(D14) — 표시만 한다. */
  holdQty: number;
  netQty: number;
  unitPrice: number;
  grossSales: number;
  discount: number;
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

/**
 * ⑤ One sale date of the dashboard sales chart. `GET /api/admin/sales/daily` (FEATURE_2610_29 D22).
 * One row per date of the period, a date without sales included with zeros.
 */
export interface DailySales {
  /** `yyyy-MM-dd` sale date. */
  date: string;
  /** Same amount as `SellerSales.grossSales` (before discount). */
  grossSales: number;
  /** Orders of that date in that amount (an order cancelled in full is not counted). */
  orderCount: number;
}

/** 알 수 없는 코드는 원문 그대로 — 두 번째 마켓이 붙어도 화면이 빈칸이 되지 않는다. */
export const platformLabel = (platform: string): string => platformName(platform);

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

/**
 * 채널 고정비 표시 (PLAN 2609_33 D7). 🔴 비용이므로 <b>음수 부호</b>를 붙인다.
 *
 * `0` / `undefined`(백엔드 미배포) 는 `—` 다.
 * ⚠️ 경고색을 쓰지 말 것 — 정상적으로 나가는 비용이지 문제가 아니다.
 * 🔴 `0` 인 이유(임계 미달인지 설정이 없는지)를 화면이 매출과 비교해 추측하지 않는다(D2 — 판정은 서버).
 */
export const formatFixedCost = (value: number | null | undefined): string =>
  value ? `−${formatMoney(value)}` : '—';

/**
 * Fixed-cost rule of a channel other than 11st (D2 · D4) — the hint of one channel card or row. A header over rows of
 * mixed platforms uses {@link FIXED_COST_HINT_MIXED}; an 11st channel uses {@link ELEVENST_FIXED_COST_HINT}
 * (FEATURE_2610_20 / D42).
 */
export const FIXED_COST_HINT =
  '그 달 상품 매출이 기준 이상인 달에만 부과됩니다. 일할 계산은 없습니다.';

/** Fixed-cost rule of an 11st channel — judged on the previous month's purchase-confirmed sales (FEATURE_2610_20 / D42). */
export const ELEVENST_FIXED_COST_HINT =
  '전달 11번가 구매확정액(판매가 + 옵션가)이 기준 이상인 달에만 부과됩니다. 일할 계산은 없습니다.';

/** Header hint over rows of mixed platforms — one header covers both rules (FEATURE_2610_20 / D42). */
export const FIXED_COST_HINT_MIXED =
  '11번가 외 채널: 그 달 상품 매출이 기준 이상인 달에만 부과됩니다. 11번가: 전달 11번가 구매확정액(판매가 + 옵션가)이 기준 이상인 달에만 부과됩니다. 일할 계산은 없습니다.';

/** The fixed-cost hint of one channel: {@link ELEVENST_FIXED_COST_HINT} for 11st, otherwise {@link FIXED_COST_HINT}. */
export const fixedCostHintFor = (platform: string | null | undefined): string =>
  platform === 'ELEVENST' ? ELEVENST_FIXED_COST_HINT : FIXED_COST_HINT;

/** 순이익이 비어 있는 이유를 셀 툴팁으로 설명한다(헤더 툴팁만으론 행마다 다른 상태를 못 보여준다). */
export const PROFIT_PENDING_HINT =
  '순이익 추정치는 상품 단가와 비용(택배비, 상자비 등)이 모두 작성 완료되어야 표시가능합니다.';

/** Why 「정산 추정 금액」 is `—` — the cell hint, only when the value is `—` (FEATURE_2611_05 D10 · D14 · D15). */
export const SETTLEMENT_PENDING_HINT = '수수료 기준이 없는 주문이 있어 정산 추정 금액을 계산할 수 없습니다.';
