import type { OrderItem } from '@/domain/entities/OrderEntity';

export interface OrderSyncResponse {
  syncedAt: string;
  newOrders: number;
  updatedOrders: number;
  canceledUpdated: number;
  orders: OrderItem[];
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
