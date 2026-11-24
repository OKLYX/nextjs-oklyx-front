import type { StockWorkRepository } from '@/domain/repositories/StockWorkRepository';
import type { ClaimWorkRequest, OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';
import type { ClaimWork, ShippedOrder } from '@/domain/entities/StockWorkEntity';

/** Stock work screens (FEATURE_2611_34). Thin delegation to the repository. */
export class StockWorkUseCase {
  constructor(private repository: StockWorkRepository) {}

  outboundWork(request: OutboundWorkRequest): Promise<void> {
    return this.repository.outboundWork(request);
  }

  byReturnInvoice(value: string): Promise<ClaimWork[]> {
    return this.repository.byReturnInvoice(value);
  }

  byParcelInvoice(value: string): Promise<ClaimWork[]> {
    return this.repository.byParcelInvoice(value);
  }

  shippedOrders(): Promise<ShippedOrder[]> {
    return this.repository.shippedOrders();
  }

  byOrder(orderId: number): Promise<ClaimWork[]> {
    return this.repository.byOrder(orderId);
  }

  returnIn(request: ClaimWorkRequest): Promise<void> {
    return this.repository.returnIn(request);
  }

  byReshipInvoice(value: string): Promise<ClaimWork[]> {
    return this.repository.byReshipInvoice(value);
  }

  openExchanges(): Promise<ClaimWork[]> {
    return this.repository.openExchanges();
  }

  exchangeShip(request: ClaimWorkRequest): Promise<void> {
    return this.repository.exchangeShip(request);
  }
}
