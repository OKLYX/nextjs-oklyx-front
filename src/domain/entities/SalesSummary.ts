/**
 * 매출 집계 (FEATURE_2609_30 / PLAN D2 · D3 · D4 · D14 · D15, 백엔드 03 SSOT).
 *
 * 🔴 <b>축이 둘 섞여 있다.</b> `grossSales`/`discount`/`estFee`/`estNetProfit` 은 <b>판매일</b> 축의 기간
 * 합계이고, `pendingPayout`("정산 추정 금액")은 <b>매출인식일</b> 축의 <b>기간 무관</b> 총액이다(D4).
 * 화면은 기간을 바꿔도 안 변하는 이 값에 반드시 `기간 무관 · 미지급 잔액` 라벨을 붙인다 —
 * 라벨이 없으면 버그로 오해받는다.
 *
 * 🔴 <b>대사 상태 건수(금액 차이 N)는 이 응답에 없다</b>(FEATURE_2609_34). 지급 묶음은 매출인식일 축이라
 * 기간을 좁혀도 건수가 변하지 않는데, 그것을 기간 필터가 달린 행에 배지로 걸면 "이번 달에 N건이 어긋났다"로
 * 읽힌다(실제로는 그 채널의 전체 건수였다). 대사 상태는 채널을 펼쳤을 때 나오는 인식월별 정산 목록이
 * 건별로 보여준다 — 배지를 되살리지 말 것.
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
  /** 🔴 기간 무관 "정산 추정 금액". 기간 필터와 함께 묶어 라벨링하지 말 것(D4). */
  pendingPayout: number;
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
  pendingPayout: number;
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

/**
 * 채널 고정비 표시 (PLAN 2609_33 D7). 🔴 비용이므로 <b>음수 부호</b>를 붙인다.
 *
 * `0` / `undefined`(백엔드 미배포) 는 `—` 다.
 * ⚠️ 경고색을 쓰지 말 것 — 정상적으로 나가는 비용이지 문제가 아니다.
 * 🔴 `0` 인 이유(임계 미달인지 설정이 없는지)를 화면이 매출과 비교해 추측하지 않는다(D2 — 판정은 서버).
 */
export const formatFixedCost = (value: number | null | undefined): string =>
  value ? `−${formatMoney(value)}` : '—';

/** 고정비 열 헤더 툴팁. 월 단위 조건부 부과라는 규칙을 화면에서 설명한다(D2 · D4). */
export const FIXED_COST_HINT =
  '그 달 상품 매출이 기준 이상인 달에만 부과됩니다. 일할 계산은 없습니다.';

/** 순이익이 비어 있는 이유를 셀 툴팁으로 설명한다(헤더 툴팁만으론 행마다 다른 상태를 못 보여준다). */
export const PROFIT_PENDING_HINT =
  '순이익 추정치는 상품 단가와 비용(택배비, 상자비 등)이 모두 작성 완료되어야 표시가능합니다.';
