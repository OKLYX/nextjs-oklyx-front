import type { OrderItem } from '@/domain/entities/OrderEntity';

export interface OrderSyncResponse {
  syncedAt: string;
  newOrders: number;
  updatedOrders: number;
  canceledUpdated: number;
  orders: OrderItem[];
}
