import type { OrderRepository } from '@/domain/repositories/OrderRepository';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';
import type {
  CancelReasonOption, ElevenstCancelFaultRejectPayload, ElevenstCancelRejectPayload, ElevenstCancelRequest,
  ElevenstChoices, ElevenstDeliveryDelayPayload, ElevenstDeliveryLine, ElevenstSellerReturnPayload,
  InternalStageResult, OrderAcknowledgeResult, OrderCancelLine, OrderCancelResult,
  OrderMonth, OrderRefreshResult, OrderSetting, OrderSyncResponse, OrderSyncResult, SyncTarget,
} from '@/application/dto/OrderDTOs';

export class OrderUseCase {
  constructor(private repository: OrderRepository) {}

  async getOrders(sellerId?: number, period?: OrderPeriodRange): Promise<OrderItem[]> {
    return this.repository.getOrders(sellerId, period);
  }

  async getOrderMonths(): Promise<OrderMonth[]> {
    return this.repository.getOrderMonths();
  }

  async syncOrders(
    params?: { sellerId?: number; accountId?: number },
  ): Promise<OrderSyncResponse> {
    return this.repository.syncOrders(params);
  }

  async getSyncTargets(sellerId?: number): Promise<SyncTarget[]> {
    return this.repository.getSyncTargets(sellerId);
  }

  async syncPeriod(accountId: number, range: OrderPeriodRange): Promise<OrderSyncResult> {
    return this.repository.syncPeriod(accountId, range);
  }

  async acknowledgeOrders(orderItemIds: number[]): Promise<OrderAcknowledgeResult> {
    return this.repository.acknowledgeOrders(orderItemIds);
  }

  async refreshOrders(orderItemIds: number[]): Promise<OrderRefreshResult> {
    return this.repository.refreshOrders(orderItemIds);
  }

  async getCancelReasons(): Promise<CancelReasonOption[]> {
    return this.repository.getCancelReasons();
  }

  async cancelOrders(lines: OrderCancelLine[], reason: string): Promise<OrderCancelResult> {
    return this.repository.cancelOrders(lines, reason);
  }

  async markInternal(orderItemIds: number[]): Promise<InternalStageResult> {
    return this.repository.markInternal(orderItemIds);
  }

  async releaseInternal(orderItemIds: number[]): Promise<InternalStageResult> {
    return this.repository.releaseInternal(orderItemIds);
  }

  async getOrderSetting(): Promise<OrderSetting> {
    return this.repository.getOrderSetting();
  }

  async updateOrderSetting(reservedShipmentTime: string): Promise<OrderSetting> {
    return this.repository.updateOrderSetting(reservedShipmentTime);
  }

  async getElevenstCancelRequests(orderItemId: number): Promise<ElevenstCancelRequest[]> {
    return this.repository.getElevenstCancelRequests(orderItemId);
  }

  async approveElevenstCancel(requestId: number): Promise<void> {
    return this.repository.approveElevenstCancel(requestId);
  }

  async rejectElevenstCancel(requestId: number, payload: ElevenstCancelRejectPayload): Promise<void> {
    return this.repository.rejectElevenstCancel(requestId, payload);
  }

  async getElevenstReturnReasons(): Promise<CancelReasonOption[]> {
    return this.repository.getElevenstReturnReasons();
  }

  async requestElevenstReturn(orderItemId: number, payload: ElevenstSellerReturnPayload): Promise<void> {
    return this.repository.requestElevenstReturn(orderItemId, payload);
  }

  async getElevenstChoices(): Promise<ElevenstChoices> {
    return this.repository.getElevenstChoices();
  }

  async cancelElevenstLine(orderItemId: number, quantity: number, reasonCode: string, reasonText: string):
    Promise<OrderCancelResult> {
    return this.repository.cancelElevenstLine(orderItemId, quantity, reasonCode, reasonText);
  }

  async rejectElevenstCancelFault(requestId: number, payload: ElevenstCancelFaultRejectPayload): Promise<void> {
    return this.repository.rejectElevenstCancelFault(requestId, payload);
  }

  async getElevenstDeliveryLines(orderItemId: number): Promise<ElevenstDeliveryLine[]> {
    return this.repository.getElevenstDeliveryLines(orderItemId);
  }

  async sendElevenstDeliveryDelay(orderItemId: number, payload: ElevenstDeliveryDelayPayload): Promise<void> {
    return this.repository.sendElevenstDeliveryDelay(orderItemId, payload);
  }

  async completeElevenstVisitPickup(orderItemId: number, certCode: string): Promise<void> {
    return this.repository.completeElevenstVisitPickup(orderItemId, certCode);
  }

  async confirmElevenstStock(orderItemId: number): Promise<void> {
    return this.repository.confirmElevenstStock(orderItemId);
  }
}
