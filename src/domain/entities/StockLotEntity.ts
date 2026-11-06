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
  /** The seller of `sellerName`; null when `sellerName` is null (FEATURE_2611_16 D11). */
  sellerId: number | null;
  /** Outbound = the order seller. null on an undecided intake row (its owners are in `owners`). */
  sellerName: string | null;
  /** Undecided intake only: 「{seller} {qty}」. */
  owners: string[];
  /** Undecided intake only: what no receipt took yet. */
  undecidedLeft: number | null;
  orderNumber: string | null;
  /** Outbound only: 「{seller} 재고 사용」 · 「영수증 미등록 재고 사용」. */
  tags: string[];
  /**
   * Purchase-price amount; null = 「미기입」. An undecided intake row = its shares' amounts + what is left × the
   * undecided unit price (FEATURE_2611_16 D8).
   */
  amount: number | null;
  /** A decided incoming row without a receipt — a 「판매자 바꾸기」 target (FEATURE_2611_01 D15). */
  sellerChangeable: boolean;
  /** The purchase record 「매입가 넣기」 retypes (FEATURE_2611_16 D1 · D17); null = not a target. */
  recordId: number | null;
  /** That record's receipt kind; null when `recordId` is null. */
  receiptKind: ReceiptKind | null;
  /** That record's receipt; null = none. */
  receiptId: number | null;
  /** Undecided intake only: every assigned share, each a line of its own (D8). */
  shares: StockDailyShare[];
}

/** Which receipt a purchase is a line of (FEATURE_2611_16 D8 · D13 · D18). */
export type ReceiptKind = 'NO_RECEIPT' | 'RECEIPT_LATER' | 'RECEIPT';

/** One share of an undecided intake row (FEATURE_2611_16 D8) — always a 「매입가 넣기」 target. */
export interface StockDailyShare {
  recordId: number;
  sellerId: number;
  sellerName: string;
  quantity: number;
  /** The share's total; null = 「미기입」. */
  amount: number | null;
  receiptKind: ReceiptKind;
  receiptId: number | null;
  /** A 「영수증 없음」 share — a 「판매자 바꾸기」 target (FEATURE_2611_01 D15). */
  sellerChangeable: boolean;
}

/** The share-line words (D8): 「영수증 없음」 · 「영수증 나중에」 · 「영수증」. */
export const RECEIPT_KIND_LABELS: Record<ReceiptKind, string> = {
  NO_RECEIPT: '영수증 없음',
  RECEIPT_LATER: '영수증 나중에',
  RECEIPT: '영수증',
};

/** A share line's amount as D8 writes it (「12,000원」), or 「미기입」 for null. */
export function formatShareAmount(amount: number | null): string {
  return amount === null ? '미기입' : `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/** The share line of the daily table (D8): 「└ ○○ 3개 · 영수증 없음 · 12,000원」. */
export function shareLineText(share: StockDailyShare): string {
  return `└ ${share.sellerName} ${share.quantity}개 · ${RECEIPT_KIND_LABELS[share.receiptKind]} · ${formatShareAmount(share.amount)}`;
}

/** One checked 「매입가 넣기」 target — a decided row's purchase record or a share (FEATURE_2611_16 D7). */
export interface PurchasePriceTarget {
  recordId: number;
  productName: string;
  quantity: number;
  sellerId: number;
  sellerName: string;
  /** 「지금 금액」; null = 「미기입」. */
  amount: number | null;
  receiptKind: ReceiptKind;
  receiptId: number | null;
}

/** The target of a decided row, or null when the row is not one (D1 · D17). */
export function rowPriceTarget(row: StockDailyRow): PurchasePriceTarget | null {
  if (row.recordId === null || row.receiptKind === null || row.sellerId === null || row.sellerName === null) {
    return null;
  }
  return {
    recordId: row.recordId,
    productName: row.productName,
    quantity: row.quantity,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    amount: row.amount,
    receiptKind: row.receiptKind,
    receiptId: row.receiptId,
  };
}

/** The target of a share of `row` (D8 · D17). */
export function sharePriceTarget(row: StockDailyRow, share: StockDailyShare): PurchasePriceTarget {
  return {
    recordId: share.recordId,
    productName: row.productName,
    quantity: share.quantity,
    sellerId: share.sellerId,
    sellerName: share.sellerName,
    amount: share.amount,
    receiptKind: share.receiptKind,
    receiptId: share.receiptId,
  };
}

/** The save refusal of D11 — a photo with two or more sellers (the server sends the same text). */
export const PHOTO_ONE_SELLER_MESSAGE = '사진을 넣으면 같은 판매자 입고만 묶을 수 있습니다.';

/**
 * What the 「영수증 사진」 field can do for the checked targets (D2 · D11 · D13 · D18), checked in this order:
 * a receipt with its photo among them → BLOCKED (D18) · 「영수증 나중에」 lines only, one receipt → LATER_RECEIPT (D13) ·
 * any other mix with 「영수증 나중에」 lines → BLOCKED (D13) · otherwise NEW_RECEIPT, `sellerId` = the one seller or
 * null for two or more (D11 refuses the save with a photo).
 */
export type PurchasePricePhoto =
  | { kind: 'NEW_RECEIPT'; sellerId: number | null }
  | { kind: 'LATER_RECEIPT'; receiptId: number }
  | { kind: 'BLOCKED'; message: string };

export function purchasePricePhoto(targets: PurchasePriceTarget[]): PurchasePricePhoto {
  if (targets.some((t) => t.receiptKind === 'RECEIPT')) {
    return { kind: 'BLOCKED', message: '사진 있는 영수증 입고가 있어 사진을 올릴 수 없습니다.' };
  }
  const later = targets.filter((t) => t.receiptKind === 'RECEIPT_LATER');
  if (later.length > 0) {
    const receiptIds = new Set(later.map((t) => t.receiptId));
    if (later.length === targets.length && receiptIds.size === 1 && later[0].receiptId !== null) {
      return { kind: 'LATER_RECEIPT', receiptId: later[0].receiptId };
    }
    return { kind: 'BLOCKED', message: '사진은 같은 영수증의 「영수증 나중에」 입고만 체크했을 때 올릴 수 있습니다.' };
  }
  const sellerIds = new Set(targets.map((t) => t.sellerId));
  return { kind: 'NEW_RECEIPT', sellerId: sellerIds.size === 1 ? targets[0].sellerId : null };
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
