'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type {
  OrderMonth, OrderSyncResponse, OrderSyncResult, OrderSyncScope, SyncTarget,
} from '@/application/dto/OrderDTOs';

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

  // scope omitted -> not sent, so the server applies its default (FULL, 전 상태).
  async syncOrders(
    params?: { sellerId?: number; accountId?: number; scope?: OrderSyncScope },
  ): Promise<OrderSyncResponse> {
    const response = await axiosInstance.post('/api/orders/sync', null, { params });
    return response.data.data;
  }

  async getSyncTargets(sellerId?: number): Promise<SyncTarget[]> {
    const response = await axiosInstance.get('/api/orders/sync/targets', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }

  // One account per call; the server does not return the order list here (PLAN D8) — the caller
  // refetches the list for the selected period once the whole loop is done.
  async syncPeriod(accountId: number, range: OrderPeriodRange): Promise<OrderSyncResult> {
    const response = await axiosInstance.post('/api/orders/sync/period', null, {
      params: { accountId, from: range.from, to: range.to },
    });
    return response.data.data;
  }
}
