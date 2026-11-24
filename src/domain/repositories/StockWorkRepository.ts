import type { ClaimWorkRequest, OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';
import type { ClaimWork, ShippedOrder } from '@/domain/entities/StockWorkEntity';

/** Stock work screens (FEATURE_2611_34). */
export interface StockWorkRepository {
  outboundWork(request: OutboundWorkRequest): Promise<void>;
  byReturnInvoice(value: string): Promise<ClaimWork[]>;
  byParcelInvoice(value: string): Promise<ClaimWork[]>;
  shippedOrders(): Promise<ShippedOrder[]>;
  byOrder(orderId: number): Promise<ClaimWork[]>;
  returnIn(request: ClaimWorkRequest): Promise<void>;
  byReshipInvoice(value: string): Promise<ClaimWork[]>;
  openExchanges(): Promise<ClaimWork[]>;
  exchangeShip(request: ClaimWorkRequest): Promise<void>;
}
