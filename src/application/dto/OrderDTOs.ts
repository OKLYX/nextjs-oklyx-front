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
