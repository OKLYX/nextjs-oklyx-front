import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type {
  OrderAcknowledgeResult, OrderMonth, OrderSyncResponse, OrderSyncResult, OrderSyncScope, SyncTarget,
} from '@/application/dto/OrderDTOs';

export interface OrderRepository {
  getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]>;
  getOrderMonths(): Promise<OrderMonth[]>;
  // scope omitted -> not sent, so the server applies its default (FULL, 전 상태).
  syncOrders(
    params?: { sellerId?: number; accountId?: number; scope?: OrderSyncScope },
  ): Promise<OrderSyncResponse>;
  getSyncTargets(sellerId?: number): Promise<SyncTarget[]>;
  syncPeriod(accountId: number, range: OrderPeriodRange): Promise<OrderSyncResult>;
  acknowledgeOrders(orderItemIds: number[]): Promise<OrderAcknowledgeResult>;
}
