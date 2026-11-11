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

/** Lots, intake work, daily in/out and seller debts (FEATURE_2610_19). Every path is ADMIN only. */
export interface StockLotRepository {
  daily(date: string): Promise<StockDaily>;
  barcode(value: string): Promise<IntakeBarcode>;
  /** 「입고 작업」 [입고 저장]: the stock rows written, in line order (FEATURE_2611_22 D3 ①). */
  intake(request: IntakeRequest): Promise<number[]>;
  /** Receipt assignment of the day on the screen (D118 · D121). */
  assign(movedOn: string, photo: File, request: CreateReceiptRequest): Promise<void>;
  /** 「영수증 없이 판매자 정하기」 of the day on the screen (FEATURE_2611_01 D2 · D4). */
  assignWithoutReceipt(movedOn: string, request: ReceiptlessAssignRequest): Promise<void>;
  /** 「판매자 바꾸기」 (FEATURE_2611_01 D7 · D15). */
  changeSeller(request: SellerChangeRequest): Promise<void>;
  /** 「매입가 넣기」 of the day on the screen (FEATURE_2611_16 D2 · D7); photo null = amounts only. */
  retypePrices(movedOn: string, photo: File | null, request: PurchasePriceRequest): Promise<void>;
  /** The row popup's one save of the day on the screen (FEATURE_2611_17 D5); photo null = none. */
  editRow(movedOn: string, photo: File | null, request: DailyRowEditRequest): Promise<void>;
  /** The 「날짜 바꾸기」 window (FEATURE_2611_21 D9). */
  moveDate(request: DailyDateMoveRequest): Promise<void>;
  /** The 「채울까요?」 window of the given saved lots (FEATURE_2611_22 D3 ① · D31); empty = no window. */
  fillCandidates(lotIds: number[]): Promise<FillCandidate[]>;
  /** The lots [입고로 채우기] offers for one row (FEATURE_2611_22 D15). */
  fillLots(movementId: number): Promise<FillLot[]>;
  /** [채우기] (FEATURE_2611_22 D3). */
  fill(request: StockFillRequest): Promise<void>;
  debtPairs(): Promise<SellerDebtPair[]>;
  debtEntries(sellerAId: number, sellerBId: number): Promise<SellerDebtEntry[]>;
  settle(request: SettlementRequest): Promise<void>;
  cancelSettlement(settlementId: number): Promise<void>;
  fillUnitPrice(debtId: number, unitPrice: number): Promise<void>;
}
