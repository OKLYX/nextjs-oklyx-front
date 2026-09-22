import type { OrderItem, OrderStatus } from '@/domain/entities/OrderEntity';
import type { FailedBox, SkippedOrder } from './ShippingLabelDTOs';

/** 동기화 1회의 집계 결과. 기간 백필(`POST /api/orders/sync/period`)은 목록 없이 이것만 돌려준다(PLAN D8). */
export interface OrderSyncResult {
  /** 실제로 조회한 시각. 전 채널을 건너뛴 회차는 조회를 안 했으므로 null 이다(FEATURE_2609_48 / D9). */
  syncedAt: string | null;
  newOrders: number;
  updatedOrders: number;
  /** 기간 백필에서는 항상 0 — 취소 보정을 돌리지 않는다(PLAN D4). */
  canceledUpdated: number;
  /** 이미 같은 채널이 동기화 중이라 건너뛴 채널 수. 실패가 아니다(FEATURE_2609_48 / D5). */
  skippedAccounts: number;
}

export interface OrderSyncResponse extends OrderSyncResult {
  orders: OrderItem[];
}

/** GET /api/orders/months 응답 행 — 주문이 존재하는 달(yyyy-MM)과 그 달의 주문 라인 수. */
export interface OrderMonth {
  ym: string;
  count: number;
}

/** 채널(계정) 단위 마지막 동기화 결과. PARTIAL = 일부만 반영됨(사유는 lastSyncError). */
export type SyncStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

/** GET /api/orders/sync/targets 응답 행 — 동기화 대상 계정 1개 + 서버가 낙인한 마지막 결과. */
export interface SyncTarget {
  accountId: number;
  sellerId: number;
  sellerName: string;
  platform: string;
  accountAlias: string | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncAt: string | null;
  lastOrderSyncAt: string | null;
  lastCancelSyncAt: string | null;
  /** 클레임 적재+추적이 끝난 마지막 회차 (FEATURE_2609_70 / D16) — 반품/교환 화면의 「마지막 동기화」. */
  lastClaimSyncAt: string | null;
  lastSyncError: string | null;
}

/**
 * 발주처리 결과 (POST /api/admin/orders/acknowledge).
 *
 * 백엔드가 `ShipmentConfirmResult.FailedBox`/`SkippedOrder` 를 그대로 재사용하므로 프론트도 같은 타입을
 * import 한다 — shape 을 새로 적으면 두 벌이 되어 서버와 조용히 어긋난다.
 * 실패 사유는 쿠팡 원문 그대로 노출한다(PLAN 2609_17 D8·D15).
 */
export interface OrderAcknowledgeResult {
  requestedLines: number;
  targetBoxes: number;
  succeeded: number;
  failed: FailedBox[];
  skipped: SkippedOrder[];
  unsupported: string[];
}

/**
 * 주문 상태 갱신 결과 (POST /api/orders/refresh).
 *
 * 모든 목록이 <b>주문번호 단위</b>다(PLAN 2609_50 D6) — 보낸 것은 라인 id 지만 조회·보고 단위는 주문이다.
 * `refreshed` 가 0 이어도 실패가 아니다: 이미 최신이면 0 이 정상이다.
 */
export interface OrderRefreshResult {
  /** dedupe 후 실제로 조회를 시도한 주문 수. */
  requestedOrders: number;
  /** 박스를 1건 이상 반영한 주문 수. */
  refreshed: number;
  /** 쿠팡이 0박스를 돌려준 주문번호 — 전량 취소로 추정(실패 아님). */
  empty: string[];
  /**
   * 쿠팡이 "이미 취소 또는 반품된 주문"이라고 답한 건(2026-09-16 신설).
   *
   * 서버가 로컬도 함께 정리한다 — 발송 전 라인만 취소로 확정(`cancelledLines`)하고,
   * 발송 이후 라인은 매출이 잡힌 건이라 그대로 둔다(`keptLines`).
   */
  cancelled: { externalOrderId: string; cancelledLines: number; keptLines: number }[];
  /** 조회·파싱 실패 주문. 사유는 원문 그대로 보여준다. */
  failed: { externalOrderId: string; reason: string }[];
  /** 비-쿠팡이라 조회할 수 없는 주문번호. */
  unsupported: string[];
}

/**
 * 취소 사유 1행 (GET /api/admin/orders/cancel-reasons).
 *
 * ⚠️ 사유 목록의 유일한 소유자는 서버다(PLAN 2609_25 D4) — 코드→라벨 상수를 프론트에 만들지 말 것.
 * 서버 enum 이 목록과 검증을 함께 소유하므로 값이 늘어도(D18) 화면은 그대로 따라간다.
 */
export interface CancelReasonOption {
  code: string;
  label: string;
}

/** POST /api/admin/orders/cancel 요청 라인. quantity 는 1..purchasableQty(D3). */
export interface OrderCancelLine {
  orderItemId: number;
  quantity: number;
}

/**
 * 취소에 성공한 라인 — 화면 즉시 갱신용 값이 함께 온다(D14).
 *
 * ⚠️ 취소수량·보류수량이 **둘 다** 온다: 결제완료 취소(`CANCEL`)는 cancelCount 가, 상품준비중
 * 취소(`STOP_SHIPMENT`)는 holdCount 가 는다(D7). 한쪽만 보고 그리면 상품준비중 취소에서
 * 숫자가 그대로로 보여 성공을 못 알아본다.
 */
export interface CancelledLine {
  orderItemId: number;
  cancelledQty: number;
  resultCancelCount: number;
  resultHoldCount: number;
  resultPurchasableQty: number;
  /** 전량취소(cancel+hold ≥ orderCount)면 'CANCELLED', 아니면 라인의 중립 상태. */
  resultStatus: OrderStatus;
  receiptId: string | null;
  /** CANCEL(즉시취소) | STOP_SHIPMENT(출고중지). */
  receiptType: string | null;
}

/** 취소에 실패한 라인 — code/message 는 쿠팡 원문(D16). 번역·요약 금지. */
export interface FailedLine {
  orderItemId: number;
  externalItemId: string;
  code: string;
  message: string;
}

/** 전송하지 않은 라인 — skipped·unsupported 가 같은 모양이다(D20). `SkippedOrder` 재사용 금지. */
export interface SkippedLine {
  orderItemId: number;
  externalOrderId: string;
  /** 중립 상태(OrderStatus) — 한글 라벨 변환은 화면 몫이다. */
  status: OrderStatus;
  reason: string;
}

/**
 * 발송 전 주문 취소 결과 (POST /api/admin/orders/cancel).
 *
 * 목록 4종이 전부 **라인 단위**다(D20) — 요청이 lines 배열이라 결과가 주문 단위면 어느 라인이
 * 걸러졌는지 화면이 맞출 수 없다. 그래서 `ShippingLabelDTOs` 의 `FailedBox`/`SkippedOrder` 를
 * 재사용하지 않는다.
 */
export interface OrderCancelResult {
  requestedLines: number;
  succeededLines: number;
  succeededQty: number;
  cancelled: CancelledLine[];
  failed: FailedLine[];
  skipped: SkippedLine[];
  unsupported: SkippedLine[];
}
