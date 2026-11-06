import type { IntakeBarcode, SellerDebtEntry, SellerDebtPair, StockDaily } from '@/domain/entities/StockLotEntity';
import type {
  IntakeRequest,
  PurchasePriceRequest,
  ReceiptlessAssignRequest,
  SellerChangeRequest,
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
  /** 「영수증 없이 판매자 정하기」 of the day on the screen (FEATURE_2611_01 D2 · D4). */
  assignWithoutReceipt(movedOn: string, request: ReceiptlessAssignRequest): Promise<void>;
  /** 「판매자 바꾸기」 (FEATURE_2611_01 D7 · D15). */
  changeSeller(request: SellerChangeRequest): Promise<void>;
  /** 「매입가 넣기」 of the day on the screen (FEATURE_2611_16 D2 · D7); photo null = amounts only. */
  retypePrices(movedOn: string, photo: File | null, request: PurchasePriceRequest): Promise<void>;
  debtPairs(): Promise<SellerDebtPair[]>;
  debtEntries(sellerAId: number, sellerBId: number): Promise<SellerDebtEntry[]>;
  settle(request: SettlementRequest): Promise<void>;
  cancelSettlement(settlementId: number): Promise<void>;
  fillUnitPrice(debtId: number, unitPrice: number): Promise<void>;
}
