import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type { OrderMonth, OrderSyncResponse, SyncTarget } from '@/application/dto/OrderDTOs';

export class OrderUseCase {
  constructor(private repository: OrderRepository) {}

  async getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]> {
    return this.repository.getOrders(sellerId, period);
  }

  async getOrderMonths(): Promise<OrderMonth[]> {
    return this.repository.getOrderMonths();
  }

  async syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse> {
    return this.repository.syncOrders(params);
  }

  async getSyncTargets(sellerId?: number): Promise<SyncTarget[]> {
    return this.repository.getSyncTargets(sellerId);
  }
}
