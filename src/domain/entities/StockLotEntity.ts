import type { StockBalance, StockMovementType, StockReason } from './StockEntity';
import type { ReceiptSummary } from './PurchaseReceiptEntity';

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
  /** Undecided intake only: 「{seller}」 — the name only, each seller once (FEATURE_2611_18 D1 · D3). */
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
  /**
   * The unit prices behind `amount`, one per price with its count, first appearance order (FEATURE_2611_17 D1 · D16);
   * null when `amount` is null (「미기입」).
   */
  unitPrices: UnitCount[] | null;
  /** A part of `amount` has a unit price filled from the registered price — show 「미기입」 next to it (D22). */
  priceFromBase: boolean;
  /** An opening-stock row the row popup may price (FEATURE_2611_17 D5 · D17). */
  openingPriceEditable: boolean;
  /** Outgoing rows only: the lot it came from (FEATURE_2611_21 D18 · D22); null = no lot or not an outgoing row. */
  sourceMovementId: number | null;
  /** The day of that lot (YYYY-MM-DD); null with `sourceMovementId`. */
  sourceMovedOn: string | null;
  /** That lot has a value to fix — otherwise 「이 입고는 값을 고칠 수 없습니다.」 (FEATURE_2611_21 D20). */
  sourcePriceEditable: boolean;
  /** The day corrections of this row, newest first (FEATURE_2611_21 D24); empty = never corrected. */
  dateEdits: StockDateEdit[];
}

/** One day correction of a daily row (FEATURE_2611_21 D7 · D24). `editedAt` = KST wall clock as stored. */
export interface StockDateEdit {
  editedAt: string;
  /** The login email of the admin; null = written outside a request. */
  editedBy: string | null;
  oldMovedOn: string;
  newMovedOn: string;
}

/** One unit price of a row and how many pieces carry it (FEATURE_2611_17 D16). */
export interface UnitCount {
  unitPrice: number;
  quantity: number;
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
  /** The share's unit price; null = 「미기입」 (FEATURE_2611_17 D2). */
  unitPrice: number | null;
  /** The unit price was filled from the registered price — show 「미기입」 (D22). */
  priceFromBase: boolean;
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

/**
 * The share line of the daily table (D8 · FEATURE_2611_17 D2 · D22): 「└ ○○ 3개 · 영수증 없음 · 12,000원 · 단가 4,000원」,
 * then 「 · 미기입」 when the unit price was filled from the registered price.
 */
export function shareLineText(share: StockDailyShare): string {
  const base = `└ ${share.sellerName} ${share.quantity}개 · ${RECEIPT_KIND_LABELS[share.receiptKind]} · ${formatShareAmount(share.amount)} · 단가 ${formatShareAmount(share.unitPrice)}`;
  return share.priceFromBase ? `${base} · ${PRICE_FROM_BASE_LABEL}` : base;
}

/** The mark next to a unit price and amount filled from the registered price (FEATURE_2611_17 D22). */
export const PRICE_FROM_BASE_LABEL = '미기입';

/**
 * The 「단가」 cell (FEATURE_2611_17 D1 · D16): one price 「4,000원」 · several 「4,000원×3 · 5,000원×2」 · null 「미기입」.
 * Each price is written as a share amount (rounded won with thousands separators).
 */
export function unitPriceText(unitPrices: UnitCount[] | null): string {
  if (unitPrices === null || unitPrices.length === 0) return '미기입';
  if (unitPrices.length === 1) return formatShareAmount(unitPrices[0].unitPrice);
  return unitPrices.map((u) => `${formatShareAmount(u.unitPrice)}×${u.quantity}`).join(' · ');
}

/** The mark of a row whose day was corrected (FEATURE_2611_21 D24). */
export const DATE_EDITED_LABEL = '날짜 고침';

/** The fixed texts of the day correction (FEATURE_2611_21 D9 · D13 · D20) — the server sends the same refusals. */
export const RECEIPT_ROW_DATE_MESSAGE = '영수증에 묶인 입고는 날짜를 옮길 수 없습니다.';
export const RECEIPT_SHARE_DATE_MESSAGE = '영수증에 묶인 몫이 있어 날짜를 옮길 수 없습니다.';
export const NO_SOURCE_MESSAGE = '어느 입고에서 나갔는지 기록이 없어 값을 고칠 곳이 없습니다.';
export const SOURCE_FIXED_MESSAGE = '이 입고는 값을 고칠 수 없습니다.';

/** 「11월 3일」 of a YYYY-MM-DD day (FEATURE_2611_21 D9 · D17 · D34 「○월 ○일」). */
export function monthDayText(day: string): string {
  const [, month, date] = day.split('-');
  return `${Number(month)}월 ${Number(date)}일`;
}

/** The notice after a day was moved (FEATURE_2611_21 D9): 「11월 3일로 옮겼습니다.」. */
export function movedMessage(day: string): string {
  return `${monthDayText(day)}로 옮겼습니다.`;
}

/** The button of an outgoing row with a lot (FEATURE_2611_21 D17 · D21): 「11월 3일 입고로 이동」. */
export function goToIntakeLabel(day: string): string {
  return `${monthDayText(day)} 입고로 이동`;
}

/** The column title of the outbound tags (FEATURE_2611_17 D3). */
export const OTHER_STOCK_COLUMN_LABEL = '타출처 재고 사용';

/** The chips of the daily table (FEATURE_2611_17 D4), in screen order. */
export type DailyChip = 'ALL' | 'IN' | 'OUT';
export const DAILY_CHIPS: { key: DailyChip; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'IN', label: '입고' },
  { key: 'OUT', label: '출고' },
];

/** The two check boxes next to the chips (FEATURE_2611_17 D24 · D29). */
export const UNDECIDED_BOX_LABEL = '판매자 미정 상품';
export const RECEIPT_PENDING_BOX_LABEL = '영수증 미등록 상품';

/** The table message when rows exist but none passes the chip and boxes (FEATURE_2611_17 D28). */
export const NO_MATCH_MESSAGE = '조건에 맞는 줄이 없습니다.';

/** One row of the table with the shares shown under it (FEATURE_2611_17 D11 · D30). */
export interface VisibleDailyRow {
  row: StockDailyRow;
  shares: StockDailyShare[];
}

/** D29: a purchase with a decided seller and no receipt with its photo — 「영수증 없음」 or 「영수증 나중에」. */
const isReceiptPending = (kind: ReceiptKind | null) => kind === 'NO_RECEIPT' || kind === 'RECEIPT_LATER';

/**
 * The rows the table shows (FEATURE_2611_17 D4 · D11 · D24 · D28 · D29 · D30), in record order:
 * - chip 「입고」 = movementType STOCK_IN · 「출고」 = STOCK_OUT · 「전체」 = every row; a share follows its row.
 * - no box on → every row with all its shares.
 * - 「판매자 미정 상품」 on → an undecided intake row with a quantity left, with all its shares.
 * - 「영수증 미등록 상품」 on → a decided purchase row (`recordId`) whose receipt kind is 「영수증 없음」 or 「영수증 나중에」;
 *   and an undecided row with such shares, showing only those shares (all of them when the row is in by the first box).
 * - both on → a row in by either box (D30).
 */
export function visibleDailyRows(
  rows: StockDailyRow[],
  chip: DailyChip,
  undecidedBox: boolean,
  receiptBox: boolean
): VisibleDailyRow[] {
  const result: VisibleDailyRow[] = [];
  for (const row of rows) {
    if (chip === 'IN' && row.movementType !== 'STOCK_IN') continue;
    if (chip === 'OUT' && row.movementType !== 'STOCK_OUT') continue;
    if (!undecidedBox && !receiptBox) {
      result.push({ row, shares: row.shares });
      continue;
    }
    if (undecidedBox && (row.undecidedLeft ?? 0) > 0) {
      result.push({ row, shares: row.shares });
      continue;
    }
    if (!receiptBox) continue;
    const shares = row.shares.filter((share) => isReceiptPending(share.receiptKind));
    if (shares.length > 0) {
      result.push({ row, shares });
    } else if (row.recordId !== null && isReceiptPending(row.receiptKind)) {
      result.push({ row, shares: [] });
    }
  }
  return result;
}

/**
 * What the row popup can change for one row or share (FEATURE_2611_17 D5 · D10 · D12 · D17 ~ D20 · D24):
 * - `sellerEditable` = a 「판매자 바꾸기」 target (row `sellerChangeable` · share `sellerChangeable`).
 * - `price` = PURCHASE (a 「매입가 넣기」 target — total or unit price + 「상품 기준가에 반영」) · OPENING (an
 *   opening-stock row — total or unit price only, D18) · null (no price field).
 * - `receipt` = PICK (「영수증 없음」 purchase — a receipt of that day or a new photo, D6 · D23) · LATER_PHOTO
 *   (「영수증 나중에」 — a photo for that receipt, D19) · FIXED (a receipt with its photo — shown as text, D19) · null
 *   (not a purchase — no receipt field, D20).
 * - `dateField` (FEATURE_2611_21 D9) = EDIT (a row — the 「날짜」 field on top) · LOCKED (a purchase on a receipt with its
 *   photo — the field is off with `RECEIPT_ROW_DATE_MESSAGE`) · null (a share — no day of its own, D13).
 * - `dateEdits` = the row's day corrections (D24); empty for a share.
 */
export interface RowEditTarget {
  movementId: number | null;
  shareRecordId: number | null;
  productName: string;
  quantity: number;
  sellerId: number;
  sellerName: string;
  /** 「지금 금액」; null = 「미기입」. */
  amount: number | null;
  sellerEditable: boolean;
  price: 'PURCHASE' | 'OPENING' | null;
  receipt: 'PICK' | 'LATER_PHOTO' | 'FIXED' | null;
  receiptId: number | null;
  dateField: 'EDIT' | 'LOCKED' | null;
  dateEdits: StockDateEdit[];
}

const RECEIPT_FIELD: Record<ReceiptKind, 'PICK' | 'LATER_PHOTO' | 'FIXED'> = {
  NO_RECEIPT: 'PICK',
  RECEIPT_LATER: 'LATER_PHOTO',
  RECEIPT: 'FIXED',
};

/**
 * The popup target of a row, or null when the row has no popup (D12 · D24 — an undecided row has none); a row without
 * one opens the 「날짜 바꾸기」 window instead (FEATURE_2611_21 D9).
 */
export function rowEditTarget(row: StockDailyRow): RowEditTarget | null {
  if (row.undecidedLeft !== null || row.sellerId === null || row.sellerName === null) return null;
  const price = row.recordId !== null ? 'PURCHASE' : row.openingPriceEditable ? 'OPENING' : null;
  if (!row.sellerChangeable && price === null) return null;
  return {
    movementId: row.movementId,
    shareRecordId: null,
    productName: row.productName,
    quantity: row.quantity,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    amount: row.amount,
    sellerEditable: row.sellerChangeable,
    price,
    receipt: row.recordId !== null && row.receiptKind !== null ? RECEIPT_FIELD[row.receiptKind] : null,
    receiptId: row.receiptId,
    dateField: row.recordId !== null && row.receiptKind === 'RECEIPT' ? 'LOCKED' : 'EDIT',
    dateEdits: row.dateEdits,
  };
}

/** The popup target of a share of `row` (D10 — every share is a 「매입가 넣기」 target). */
export function shareEditTarget(row: StockDailyRow, share: StockDailyShare): RowEditTarget {
  return {
    movementId: null,
    shareRecordId: share.recordId,
    productName: row.productName,
    quantity: share.quantity,
    sellerId: share.sellerId,
    sellerName: share.sellerName,
    amount: share.amount,
    sellerEditable: share.sellerChangeable,
    price: 'PURCHASE',
    receipt: RECEIPT_FIELD[share.receiptKind],
    receiptId: share.receiptId,
    dateField: null,
    dateEdits: [],
  };
}

/**
 * The receipts the popup offers (FEATURE_2611_17 D23): that day's receipts with their photo — the given seller's
 * first, then the other sellers', each group in the order received.
 */
export function dayReceiptChoices(receipts: ReceiptSummary[], sellerId: number): ReceiptSummary[] {
  const withPhoto = receipts.filter((r) => r.hasPhoto);
  return [...withPhoto.filter((r) => r.payerSellerId === sellerId), ...withPhoto.filter((r) => r.payerSellerId !== sellerId)];
}

/** One receipt choice (D23): 「{결제 판매자} · {첫 상품} 외 N개 · {카드 별칭 | 카드 없음}」. */
export function receiptChoiceLabel(receipt: ReceiptSummary): string {
  const more = receipt.productCount > 1 ? ` 외 ${receipt.productCount - 1}개` : '';
  return `${receipt.payerSellerName} · ${receipt.firstProductName ?? '상품 없음'}${more} · ${receipt.cardAlias ?? '카드 없음'}`;
}

/** The notice before a receipt of another payer is picked (D23). */
export function sellerSwitchMessage(fromSeller: string, toSeller: string): string {
  return `판매자가 ${fromSeller} → ${toSeller} 로 바뀝니다.`;
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
