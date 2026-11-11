import type { StockLotRepository } from '@/domain/repositories/StockLotRepository';
import type {
  FillCandidate,
  FillLot,
  IntakeBarcode,
  SellerDebtEntry,
  SellerDebtPair,
  StockDaily,
} from '@/domain/entities/StockLotEntity';
import type {
  DailyDateMoveRequest,
  DailyRowEditRequest,
  IntakeRequest,
  PurchasePriceRequest,
  ReceiptlessAssignRequest,
  SellerChangeRequest,
  SettlementRequest,
  StockFillRequest,
} from '@/application/dto/StockLotDTOs';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';

/**
 * Intake work, daily in/out and seller debts (FEATURE_2610_19) + the seller without a receipt (FEATURE_2611_01) +
 * 「매입가 넣기」 (FEATURE_2611_16). Thin delegation to the repository.
 */
export class StockLotUseCase {
  constructor(private repository: StockLotRepository) {}

  daily(date: string): Promise<StockDaily> {
    return this.repository.daily(date);
  }

  barcode(value: string): Promise<IntakeBarcode> {
    return this.repository.barcode(value);
  }

  intake(request: IntakeRequest): Promise<number[]> {
    return this.repository.intake(request);
  }

  assign(movedOn: string, photo: File, request: CreateReceiptRequest): Promise<void> {
    return this.repository.assign(movedOn, photo, request);
  }

  assignWithoutReceipt(movedOn: string, request: ReceiptlessAssignRequest): Promise<void> {
    return this.repository.assignWithoutReceipt(movedOn, request);
  }

  changeSeller(request: SellerChangeRequest): Promise<void> {
    return this.repository.changeSeller(request);
  }

  retypePrices(movedOn: string, photo: File | null, request: PurchasePriceRequest): Promise<void> {
    return this.repository.retypePrices(movedOn, photo, request);
  }

  editRow(movedOn: string, photo: File | null, request: DailyRowEditRequest): Promise<void> {
    return this.repository.editRow(movedOn, photo, request);
  }

  moveDate(request: DailyDateMoveRequest): Promise<void> {
    return this.repository.moveDate(request);
  }

  fillCandidates(lotIds: number[]): Promise<FillCandidate[]> {
    return this.repository.fillCandidates(lotIds);
  }

  fillLots(movementId: number): Promise<FillLot[]> {
    return this.repository.fillLots(movementId);
  }

  fill(request: StockFillRequest): Promise<void> {
    return this.repository.fill(request);
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
