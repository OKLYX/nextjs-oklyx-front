'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type {
  CancelReasonOption, OrderAcknowledgeResult, OrderCancelLine, OrderCancelResult, OrderMonth,
  OrderSyncResponse, OrderSyncResult, OrderSyncScope, SyncTarget,
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

  // 라인 id 만 보낸다 — 박스 dedupe·상태 필터는 서버가 한다(PLAN 2609_17 D1·D2).
  async acknowledgeOrders(orderItemIds: number[]): Promise<OrderAcknowledgeResult> {
    const response = await axiosInstance.post('/api/admin/orders/acknowledge', { orderItemIds });
    return response.data.data;
  }

  // 사유 목록은 서버가 소유한다(PLAN 2609_25 D4) — 상수로 복제하지 말 것.
  async getCancelReasons(): Promise<CancelReasonOption[]> {
    const response = await axiosInstance.get('/api/admin/orders/cancel-reasons');
    return response.data.data;
  }

  // 라인 + 수량만 보낸다 — 박스 분할·상태 필터·수량 상한은 서버가 판정한다(PLAN 2609_25 D1·D2·D3).
  async cancelOrders(lines: OrderCancelLine[], reason: string): Promise<OrderCancelResult> {
    const response = await axiosInstance.post('/api/admin/orders/cancel', { lines, reason });
    return response.data.data;
  }
}
