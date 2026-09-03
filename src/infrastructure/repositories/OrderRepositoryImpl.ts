'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type { OrderMonth, OrderSyncResponse, SyncTarget } from '@/application/dto/OrderDTOs';

export class OrderRepositoryImpl implements OrderRepository {
  // period omitted -> no from/to sent, so the server applies its default window.
  async getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]> {
    const params = {
      ...(sellerId != null ? { sellerId } : {}),
      ...(period ?? {}),
    };
    const response = await axiosInstance.get('/api/orders', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data.data;
  }

  // No parameters: the month list is tenant-wide, independent of the seller filter.
  async getOrderMonths(): Promise<OrderMonth[]> {
    const response = await axiosInstance.get('/api/orders/months');
    return response.data.data;
  }

  async syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse> {
    const response = await axiosInstance.post('/api/orders/sync', null, { params });
    return response.data.data;
  }

  async getSyncTargets(sellerId?: number): Promise<SyncTarget[]> {
    const response = await axiosInstance.get('/api/orders/sync/targets', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }
}
