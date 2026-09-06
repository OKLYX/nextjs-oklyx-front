import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { FailedBox, SkippedOrder } from './ShippingLabelDTOs';

/** 동기화 1회의 집계 결과. 기간 백필(`POST /api/orders/sync/period`)은 목록 없이 이것만 돌려준다(PLAN D8). */
export interface OrderSyncResult {
  syncedAt: string;
  newOrders: number;
  updatedOrders: number;
  /** 기간 백필에서는 항상 0 — 취소 보정을 돌리지 않는다(PLAN D4). */
  canceledUpdated: number;
}

export interface OrderSyncResponse extends OrderSyncResult {
  orders: OrderItem[];
}

/**
 * 동기화가 조회할 주문 상태 범위 (백엔드 `OrderSyncScope`).
 * - FULL: 전 상태 (주문내역·구매목록)
 * - ACTIVE: 결제완료·상품준비중만 (출고관리 — 쿠팡 왕복 6회 → 2회)
 */
export type OrderSyncScope = 'FULL' | 'ACTIVE';

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
  /** 전량취소(cancel+hold ≥ orderCount)면 'CANCELLED', 아니면 기존 status. */
  resultStatus: string;
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
  status: string;
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
