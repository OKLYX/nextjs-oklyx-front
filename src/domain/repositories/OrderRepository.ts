import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type {
  CancelReasonOption, OrderAcknowledgeResult, OrderCancelLine, OrderCancelResult, OrderMonth,
  OrderSyncResponse, OrderSyncResult, SyncTarget,
} from '@/application/dto/OrderDTOs';

export interface OrderRepository {
  getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]>;
  getOrderMonths(): Promise<OrderMonth[]>;
  syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse>;
  getSyncTargets(sellerId?: number): Promise<SyncTarget[]>;
  syncPeriod(accountId: number, range: OrderPeriodRange): Promise<OrderSyncResult>;
  acknowledgeOrders(orderItemIds: number[]): Promise<OrderAcknowledgeResult>;
  getCancelReasons(): Promise<CancelReasonOption[]>;
  cancelOrders(lines: OrderCancelLine[], reason: string): Promise<OrderCancelResult>;
}
