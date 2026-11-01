import type { StockBalance, StockMovementType, StockReason } from './StockEntity';

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

/** One ledger row of 「일별 입출고 내역」 (D119 · D123 · D124 · D128 · D130). */
export interface StockDailyRow {
  movementId: number;
  movementType: StockMovementType;
  reason: StockReason | null;
  productId: number;
  productName: string;
  /** The product's representative photo as stored; null = none (FEATURE_2611_02 D8). */
  imageUrl: string | null;
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
  /** A decided incoming row without a receipt — a 「판매자 바꾸기」 target (FEATURE_2611_01 D15). */
  sellerChangeable: boolean;
  /** Undecided intake only: its 「영수증 없음」 shares, each a 「판매자 바꾸기」 target (D15). */
  noReceiptShares: NoReceiptShare[];
}

/** One 「영수증 없음」 share of an undecided intake row (FEATURE_2611_01 D15). */
export interface NoReceiptShare {
  recordId: number;
  sellerName: string;
  quantity: number;
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
  /** The found product's representative photo as stored; null = none or not found (FEATURE_2611_02 D15). */
  imageUrl: string | null;
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

/** One line of the 「재고 조회」 amount box (FEATURE_2611_02 D26 · D34). */
export interface StockAmountLine {
  /** `ALL_AMOUNT_KEY` = 「전체」 · `seller:{sellerId}` (`seller:null` = 「판매자 미정」). */
  key: string;
  label: string;
  /** Σ `amount` of that line's rows; a row with a null amount is not added (D24 · D25). */
  total: number;
  /** Rows left out of `total` — 「미기입 N줄」 (D36 · D37). */
  unknownCount: number;
}

/** The 「전체」 line of the amount box (D26). */
export const ALL_AMOUNT_KEY = 'ALL';

/** The amount-box key of a row's seller (D34). */
export const sellerAmountKey = (balance: StockBalance) => `seller:${balance.sellerId}`;

/** Whether a row belongs to an amount-box line — 「전체」 takes every row (D34 · D37). */
export const inAmountLine = (balance: StockBalance, key: string) =>
  key === ALL_AMOUNT_KEY || key === sellerAmountKey(balance);

/**
 * The amount box of the rows received (D26 · D34): 「전체」, then one line per seller in name order (the list's order —
 * plain code-unit comparison, as the server sorts), 「판매자 미정」 last.
 */
export function stockAmountLines(balances: StockBalance[]): StockAmountLine[] {
  const line = (key: string, label: string): StockAmountLine => {
    const rows = balances.filter((balance) => inAmountLine(balance, key));
    return {
      key,
      label,
      total: rows.reduce((sum, balance) => sum + (balance.amount ?? 0), 0),
      unknownCount: rows.filter((balance) => balance.amount === null).length,
    };
  };
  const sellers = new Map<string, string | null>();
  balances.forEach((balance) => sellers.set(sellerAmountKey(balance), balance.sellerName));
  const ordered = [...sellers.entries()].sort(([, a], [, b]) => {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return [
    line(ALL_AMOUNT_KEY, '전체'),
    ...ordered.map(([key, name]) => line(key, name ?? UNDECIDED_SELLER_LABEL)),
  ];
}
