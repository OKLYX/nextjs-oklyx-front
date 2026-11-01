import type { StockLotRepository } from '@/domain/repositories/StockLotRepository';
import type { IntakeBarcode, SellerDebtEntry, SellerDebtPair, StockDaily } from '@/domain/entities/StockLotEntity';
import type { IntakeRequest, SettlementRequest } from '@/application/dto/StockLotDTOs';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';

/** Intake work, daily in/out and seller debts (FEATURE_2610_19). Thin delegation to the repository. */
export class StockLotUseCase {
  constructor(private repository: StockLotRepository) {}

  daily(date: string): Promise<StockDaily> {
    return this.repository.daily(date);
  }

  barcode(value: string): Promise<IntakeBarcode> {
    return this.repository.barcode(value);
  }

  intake(request: IntakeRequest): Promise<void> {
    return this.repository.intake(request);
  }

  assign(movedOn: string, photo: File, request: CreateReceiptRequest): Promise<void> {
    return this.repository.assign(movedOn, photo, request);
  }

  debtPairs(): Promise<SellerDebtPair[]> {
    return this.repository.debtPairs();
  }

  debtEntries(sellerAId: number, sellerBId: number): Promise<SellerDebtEntry[]> {
    return this.repository.debtEntries(sellerAId, sellerBId);
  }

  settle(request: SettlementRequest): Promise<void> {
    return this.repository.settle(request);
  }

  cancelSettlement(settlementId: number): Promise<void> {
    return this.repository.cancelSettlement(settlementId);
  }

  fillUnitPrice(debtId: number, unitPrice: number): Promise<void> {
    return this.repository.fillUnitPrice(debtId, unitPrice);
  }
}
