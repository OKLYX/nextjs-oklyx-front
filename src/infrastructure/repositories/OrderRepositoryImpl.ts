'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderSyncResponse } from '@/application/dto/OrderDTOs';

export class OrderRepositoryImpl implements OrderRepository {
  async getOrders(sellerId?: number): Promise<OrderItem[]> {
    const response = await axiosInstance.get('/api/orders', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }

  async syncOrders(params?: { sellerId?: number; accountId?: number }): Promise<OrderSyncResponse> {
    const response = await axiosInstance.post('/api/orders/sync', null, { params });
    return response.data.data;
  }
}
