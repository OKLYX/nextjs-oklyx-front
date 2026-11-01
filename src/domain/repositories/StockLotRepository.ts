import type { IntakeBarcode, SellerDebtEntry, SellerDebtPair, StockDaily } from '@/domain/entities/StockLotEntity';
import type {
  IntakeRequest,
  SettlementRequest,
} from '@/application/dto/StockLotDTOs';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';

/** Lots, intake work, daily in/out and seller debts (FEATURE_2610_19). Every path is ADMIN only. */
export interface StockLotRepository {
  daily(date: string): Promise<StockDaily>;
  barcode(value: string): Promise<IntakeBarcode>;
  intake(request: IntakeRequest): Promise<void>;
  /** Receipt assignment of the day on the screen (D118 · D121). */
  assign(movedOn: string, photo: File, request: CreateReceiptRequest): Promise<void>;
  debtPairs(): Promise<SellerDebtPair[]>;
  debtEntries(sellerAId: number, sellerBId: number): Promise<SellerDebtEntry[]>;
  settle(request: SettlementRequest): Promise<void>;
  cancelSettlement(settlementId: number): Promise<void>;
  fillUnitPrice(debtId: number, unitPrice: number): Promise<void>;
}
