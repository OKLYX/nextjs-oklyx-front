import type { StockMovementType, StockReason } from './StockEntity';

/**
 * Lots, the daily in/out view and the seller debt screen (FEATURE_2610_19).
 *
 * Mirrors the server views `StockDailyView` · `StockDailyRowView` · `IntakeBarcodeView` · `SellerDebtPairView` ·
 * `SellerDebtEntryView`. An amount of `null` is 「미기입」 — never draw it as 0 (D137 · D123).
 */

/** One product of the day a receipt can still be assigned to (D121 ① · D147). */
export interface UnregisteredProduct {
  productId: number;
  productName: string;
  remainingQty: number;
}

/** One ledger row of 「그날 입출고 내역」 (D119 · D123 · D124 · D128 · D130). */
export interface StockDailyRow {
  movementId: number;
  movementType: StockMovementType;
  reason: StockReason | null;
  productId: number;
  productName: string;
  /** Signed as stored. */
  quantity: number;
  /** Outbound = the order seller. null on an undecided intake row (its owners are in `owners`). */
  sellerName: string | null;
  /** Undecided intake only: 「{seller} {qty}」. */
  owners: string[];
  /** Undecided intake only: what no receipt took yet. */
  undecidedLeft: number | null;
  orderNumber: string | null;
  /** Outbound only: 「{seller} 재고 사용」 · 「영수증 미등록 재고 사용」. */
  tags: string[];
  /** Purchase-price amount; null = 「미기입」. */
  amount: number | null;
}

export interface StockDaily {
  date: string;
  /** 「영수증 미등록 N건」 (D147); 0 = not shown. */
  unregisteredProductCount: number;
  unregistered: UnregisteredProduct[];
  rows: StockDailyRow[];
}

/** 「입고 작업」 barcode lookup (D117 ② ④). */
export interface IntakeBarcode {
  found: boolean;
  productId: number | null;
  productName: string | null;
  price: number | null;
}

/** One seller pair of 「사업자 간 채무」 (D51 · D137). sellerA has the smaller id. */
export interface SellerDebtPair {
  sellerAId: number;
  sellerAName: string;
  sellerBId: number;
  sellerBName: string;
  /** Who owes `balance`; null = balance 0 (listed only because of 「미기입」). */
  debtorId: number | null;
  balance: number;
  unknownCount: number;
}

/** One cause line of a pair (D51 · D90 · D141 · D143). */
export interface SellerDebtEntry {
  kind: 'BORROW' | 'SETTLEMENT';
  id: number;
  date: string;
  fromSellerId: number;
  fromSellerName: string;
  toSellerId: number;
  toSellerName: string;
  orderNumber: string | null;
  productName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  /** null = 「미기입」 (BORROW only). */
  amount: number | null;
  canFillPrice: boolean;
  canEditPrice: boolean;
  memo: string | null;
  cancelled: boolean;
}

/** 「판매자 미정」 seller label — the stock views show this for a seller of `null` (R2 · D116 ②). */
export const UNDECIDED_SELLER_LABEL = '판매자 미정';

/** ₩ amount with thousands separators, or 「미기입」 for null (D137 · D123). */
export function formatWonOrUnknown(amount: number | null): string {
  return amount === null ? '미기입' : `₩${Math.round(amount).toLocaleString('ko-KR')}`;
}
