import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type { OrderMonth, OrderSyncResponse, SyncTarget } from '@/application/dto/OrderDTOs';

export interface OrderRepository {
  getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]>;
  getOrderMonths(): Promise<OrderMonth[]>;
  syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse>;
  getSyncTargets(sellerId?: number): Promise<SyncTarget[]>;
}
