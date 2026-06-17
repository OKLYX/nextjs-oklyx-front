import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderSyncResponse } from '@/application/dto/OrderDTOs';

export interface OrderRepository {
  getOrders(sellerId?: number): Promise<OrderItem[]>;
  syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse>;
}
