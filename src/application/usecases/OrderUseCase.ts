import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderSyncResponse } from '@/application/dto/OrderDTOs';

export class OrderUseCase {
  constructor(private repository: OrderRepository) {}

  async getOrders(sellerId?: number): Promise<OrderItem[]> {
    return this.repository.getOrders(sellerId);
  }

  async syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse> {
    return this.repository.syncOrders(params);
  }
}
