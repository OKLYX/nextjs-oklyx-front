import { platformName } from '@/config/platforms';
import type { ParcelStatus } from '@/domain/entities/PackingEntity';

/**
 * 플랫폼 중립 주문 상태 (백엔드 `OrderStatus`).
 *
 * 쿠팡 원문 코드(ACCEPT 등)는 더 이상 `status` 로 오지 않는다 — 매핑의 주인은 서버 하나다.
 * 원문이 필요하면 `platformStatus` 를 본다. 프론트에서 원문→중립 매핑을 다시 만들지 말 것.
 */
export type OrderStatus =
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED';

/**
 * Internal stage (FEATURE_2609_75 / D9). Separate from the Coupang status (`status`) — the 1st-row status chips and the
 * acknowledge-target decision read the order status from `status` only; among on-screen chips and filters, only the
 * shipment page's 2nd-row chips under PAID read `internalStage` (FEATURE_2610_07 / D20).
 * null = none.
 */
export type InternalStage = 'INTERNAL_PREPARING' | 'AWAITING_SHIPMENT';

// 화면 문구의 단일 출처(D10·D11). 「발주대기중」「출고 준비」 등 다른 표기 금지.
export const INTERNAL_STAGE_LABELS: Record<InternalStage, string> = {
  INTERNAL_PREPARING: '내부 상품준비중',
  AWAITING_SHIPMENT: '발송대기중',
};

export interface OrderItem {
  id: number;
  marketplaceAccountId: number;
  platform: string;
  // Seller name and sales channel alias the server puts on every line; absent from older servers (FEATURE_2611_24 / D8 · D10).
  sellerName: string | null;
  accountAlias: string | null;
  externalOrderId: string;
  externalBoxId: string | null;
  externalItemId: string;
  itemName: string | null;
  ordererName: string | null;
  receiverName: string | null;
  orderCount: number;
  cancelCount: number;
  holdCount: number;
  purchasableQty: number;
  status: OrderStatus;
  // Raw platform status (Coupang ACCEPT, NONE_TRACKING, etc.). null when there is no mirror row.
  // Display aid only — screen decisions read the neutral `status`, not this value; internal-stage decisions
  // (e.g. the shipment page's 2nd-row chips under PAID) read `internalStage` (FEATURE_2610_07 / D20).
  platformStatus: string | null;
  // 전량 취소 여부 — 서버 판정(cancelCount + holdCount >= orderCount)이 유일한 기준이다.
  cancelled: boolean;
  // 내부 단계(FEATURE_2609_75 / D9 · D29). 값은 배송 묶음의 것이지만 서버가 표시용 상태가 결제완료인 줄에만 내려준다 — 같은 묶음이라도 전량 취소된 줄은 null 이다.
  internalStage: InternalStage | null;
  paidAt: string | null;
  // 주문 시점 금액 스냅샷. 과거 주문은 백필된 만큼만 채워져 null 이 온다 — 0 으로 그리지 말 것.
  unitPrice: number | null;
  lineAmount: number | null;              // 할인 전 라인 합계
  discountAmount: number | null;          // 총 할인
  platformDiscountAmount: number | null;  // 플랫폼 부담 할인
  // 11st only, false for every other line (FEATURE_2610_17 / D66 · D67) — server-decided, never re-derived here.
  visitPickup: boolean;        // visit-pickup order: [방문수령 완료] instead of the invoice form
  reservedSale: boolean;       // reserved-sale paid order (raw 201): [입고완료 처리] instead of [발주처리]
  stockConfirmSent: boolean;   // [입고완료 처리] already sent — shown as 「입고완료 보냄」
  // Row thumbnail = first component product of the line's master option (stored product.image_url as-is).
  // Both null when the server could not expand the line (unmapped option etc.) — draw an empty box.
  thumbnailProductId: number | null;
  thumbnailImageUrl: string | null;
  // Real products of the line (FEATURE_2611_15 / D16 · D18): every component product of the line's master option,
  // BOM order, quantity = per-set quantity × purchasableQty. Empty when the server could not expand the line.
  components: OrderComponentQuantity[];
}

/** One component product of an order line and how many go out (FEATURE_2611_15 / D16 · D18). */
export interface OrderComponentQuantity {
  productName: string;
  quantity: number;
}

/**
 * The order list's real product quantity text (FEATURE_2611_15 / D16): 「{name} × {quantity}」 joined by 「 · 」, e.g.
 * 「노란 수세미 × 3 · 초록 수세미 × 6」; 「-」 when the line has no components (a broken link) or an older server sent none.
 */
export const componentQuantitiesLabel = (components: OrderComponentQuantity[] | undefined): string =>
  !components || components.length === 0
    ? '-'
    : components.map((component) => `${component.productName} × ${component.quantity}`).join(' · ');

/**
 * One order for the shared order detail (FEATURE_2611_07 / PLAN D17 · D30) — 1:1 with the backend
 * `OrderDetailResponse`. The same shape comes from both reads: by the clicked order line (「주문내역」 · 「출고관리」) and by
 * the clicked parcel (「포장 작업」 「오늘 완료」). No phone, postcode or address (D22).
 */
export interface OrderDetail {
  externalOrderId: string;
  sellerName: string | null;
  /** Sales channel (`Platform` name, e.g. `COUPANG`) */
  platform: string | null;
  accountAlias: string | null;
  ordererName: string | null;
  receiverName: string | null;
  paidAt: string | null;
  /** Every line of the order, id order — each the same fields as one order list row */
  lines: OrderItem[];
  /** Every parcel of the order — bundle order, then parcel sequence (D29); empty = no invoice yet (D26) */
  parcels: OrderDetailParcel[];
  /** Where each line comes from — one per line, the order of `lines` (FEATURE_2611_15 / D1 · D3 · D5) */
  lineMasters: OrderLineMaster[];
  /** true = the viewer is an ADMIN — draw the master product link only then (FEATURE_2611_15 / D8 · D20) */
  admin: boolean;
}

/**
 * The master product, master option and component products of one order line (FEATURE_2611_15 / D1 · D3 · D5).
 * `unexpandedReason` null = linked; otherwise the broken link's code — show `unexpandedReasonLabel(code)` only.
 */
export interface OrderLineMaster {
  orderLineId: number;
  masterProductId: number | null;
  masterProductName: string | null;
  masterOptionName: string | null;
  /** BOM order — empty when `unexpandedReason` is set */
  products: OrderLineProduct[];
  /** `UNMAPPED_OPTION` · `NO_MASTER_OPTION` · `EMPTY_BOM`, null = linked */
  unexpandedReason: string | null;
}

/** One component product: quantity = per-set quantity × the line's purchasable quantity (FEATURE_2611_15 / D4 · D18). */
export interface OrderLineProduct {
  productId: number;
  productName: string;
  /** `Product.imageUrl` as stored — draw it with `getProductThumbUrl(imageUrl, productId)` */
  imageUrl: string | null;
  quantity: number;
}

/** One parcel (invoice) of the order (D23 · D36 · D37). */
export interface OrderDetailParcel {
  parcelId: number;
  invoiceNumber: string;
  carrierName: string | null;
  parcelSeq: number | null;
  status: ParcelStatus;
  /** Processed time as a KST wall clock (D38) — null for 「작업 전」 */
  packedAt: string | null;
  /** Only for 「포장 완료」, otherwise null (D37) */
  boxName: string | null;
  boxPackageId: number | null;
  /** Only for 「포장 완료」, otherwise empty (D37) — merged per product */
  items: OrderDetailParcelItem[];
}

export interface OrderDetailParcelItem {
  productId: number;
  productName: string | null;
  /** `Product.imageUrl` as stored — draw it with `getProductThumbUrl(imageUrl, productId)` */
  imageUrl: string | null;
  quantity: number;
}

/** Parcel status words of the order detail chips (D25 · D29). */
export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  PENDING: '작업 전',
  PACKED: '포장 완료',
  UNUSED: '미사용',
};

/** Chip text = the whole invoice number + the status, e.g. 「123456789012 · 포장 완료」 (D29). */
export const parcelChipLabel = (parcel: Pick<OrderDetailParcel, 'invoiceNumber' | 'status'>): string =>
  `${parcel.invoiceNumber} · ${PARCEL_STATUS_LABELS[parcel.status]}`;

/**
 * 「판매처」 text (D35) — the one source for the order detail, the order list (`OrderTable`) and the claim list (`ClaimTable`) (FEATURE_2611_24 / D15).
 * 「{channel} · {alias}」, or only 「{channel}」 when the alias is blank.
 * ⚠️ Not the packing screen's channel text (alias alone) — that one stays as it is (D35).
 */
export const salesChannelLabel = (platform: string | null, accountAlias: string | null): string => {
  const channel = platformName(platform ?? '') || '-';
  const alias = accountAlias?.trim();
  return alias ? `${channel} · ${alias}` : channel;
};

/**
 * Compare value for sorting the order list — the 「판매자」 and 「판매처」 columns compare by their on-screen text
 * (FEATURE_2611_24 / D6); every other column compares by the raw field.
 */
export const orderSortValue = (order: OrderItem, key: keyof OrderItem): OrderItem[keyof OrderItem] => {
  if (key === 'sellerName') return order.sellerName ?? '-';
  if (key === 'accountAlias') return salesChannelLabel(order.platform, order.accountAlias);
  return order[key];
};

// The reserved-sale label next to the status (FEATURE_2610_17 / D67) — one source for the list and the detail.
export const ELEVENST_RESERVED_LABEL = '11번가 예약판매';

// Maps neutral order statuses to Korean display labels
const ORDER_STATUS_LABELS: Record<string, string> = {
  PAID: '결제완료',
  PREPARING: '상품준비중',
  SHIPPED: '발송처리',
  DELIVERING: '배송중',
  DELIVERED: '배송완료',
  // 전량취소는 `status` 가 직접 CANCELLED 로 내려온다(서버 파생값) — 별도 필드를 보지 않는다.
  CANCELLED: '취소',
};

// Returns the Korean label for an order status code; falls back to the raw value
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

// Single "customer" label for the narrow list column. The receiver is what the parcel is
// addressed to, so it wins; a gift order (orderer !== receiver) still shows both in the detail modal.
export function getCustomerName(order: Pick<OrderItem, 'ordererName' | 'receiverName'>): string {
  return order.receiverName ?? order.ordererName ?? '-';
}

// Order statuses in workflow sequence; used for the status filter buttons.
// 취소(CANCELLED)는 여기 없다 — 전용 취소항목 칩이 따로 있다(CANCELED_FILTER).
export const ORDER_STATUSES = [
  'PAID',
  'PREPARING',
  'SHIPPED',
  'DELIVERING',
  'DELIVERED',
] as const;

// The order detail progress steps, left to right (FEATURE_2611_29 / R5). A fully canceled line shows 「취소됨」 in slot 2.
export const ORDER_PROGRESS_STEPS: readonly OrderStatus[] = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERING', 'DELIVERED'];

const PAID_AT_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Paid time of the order detail header (FEATURE_2611_29 / R4 · R5): `2026.11.12 오후 7:05`, or `11.12 오후 7:05` without the year.
 * `paidAt` is a KST wall clock without an offset — read by slicing the characters, never through `Date`.
 * `'-'` when null or not shaped like `yyyy-MM-ddTHH:mm`.
 */
export function formatPaidAt(paidAt: string | null, withYear: boolean): string {
  if (paidAt == null || !PAID_AT_SHAPE.test(paidAt.slice(0, 16))) return '-';
  const year = paidAt.slice(0, 4);
  const month = paidAt.slice(5, 7);
  const day = paidAt.slice(8, 10);
  const hour = Number(paidAt.slice(11, 13));
  const minute = paidAt.slice(14, 16);
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const date = withYear ? `${year}.${month}.${day}` : `${month}.${day}`;
  return `${date} ${meridiem} ${hour12}:${minute}`;
}

/** Paid clock under the 「결제완료」 progress step (FEATURE_2611_29 / R5): `19:05` sliced from `paidAt`, `''` when null or not shaped. */
export function formatPaidClock(paidAt: string | null): string {
  if (paidAt == null || !PAID_AT_SHAPE.test(paidAt.slice(0, 16))) return '';
  return paidAt.slice(11, 16);
}

/**
 * Order amount of one line = line total before discount − total discount (FEATURE_2611_29 / R15 · D8).
 * null = unknown, never 0 — either value missing (older orders before the backfill) makes the result null (2609_26 D9 · D10).
 */
export function orderNetAmount(lineAmount: number | null, discountAmount: number | null): number | null {
  if (lineAmount == null || discountAmount == null) return null;
  return lineAmount - discountAmount;
}

// 출고관리 화면 대상 — 아직 발송하지 않은 주문(PLAN 2609_15 D1).
// 전량취소는 status 가 CANCELLED 로 내려오지만, 서버 판정 `cancelled` 로도 한 번 더 제외한다.
export const SHIPMENT_STATUSES = ['PAID', 'PREPARING'] as const;

// Statuses at or past 발송처리 — an order in one of these is an invoice *edit* target, not a new
// upload. The decision itself is made by the server (PLAN 2609_11 D3); this is only used for the
// button label and the notice text in the manual shipment section.
// 추적불가(쿠팡 NONE_TRACKING)는 서버가 SHIPPED 로 접었다(PLAN 2609_26 D5) — 값이 3개다.
export const SHIPPED_STATUSES = ['SHIPPED', 'DELIVERING', 'DELIVERED'] as const;

export function isAlreadyShipped(status: string): boolean {
  return (SHIPPED_STATUSES as readonly string[]).includes(status);
}

// Filter key for fully-canceled orders. 서버가 전량취소를 status = 'CANCELLED' 로 표현하므로
// (PLAN 2609_26 D26) 이 값은 실제 상태값이고, 필터는 status 비교 하나로 끝난다.
// 별도 칩으로 빼는 이유는 목록 기본 화면에서 취소를 감추기 위함이다.
export const CANCELED_FILTER = 'CANCELLED';

// Search target chip. Customer name stays the default (PLAN 2609_27 D3).
export type OrderSearchField = 'customer' | 'orderNo' | 'product' | 'all';

// Strip whitespace + lowercase so '김 철수' matches '김철수' (2609_08 D11, reused as-is for
// the product name — one rule for every field (PLAN 2609_27 D5)).
const normalize = (value: string): string => value.replace(/\s+/g, '').toLowerCase();

type SearchableOrder = Pick<
  OrderItem,
  'ordererName' | 'receiverName' | 'externalOrderId' | 'itemName'
>;

// A gift order has different orderer/receiver names — both are searched.
const matchesCustomer = (order: SearchableOrder, needle: string): boolean =>
  [order.ordererName, order.receiverName]
    .some((name) => name != null && normalize(name).includes(needle));

const matchesOrderNo = (order: SearchableOrder, needle: string): boolean =>
  normalize(order.externalOrderId).includes(needle);

// itemName is the channel's own text (product + option in one string) and is nullable —
// a null line simply never matches by product (PLAN 2609_27 D6).
const matchesProduct = (order: SearchableOrder, needle: string): boolean =>
  order.itemName != null && normalize(order.itemName).includes(needle);

export function matchesOrderSearch(
  order: SearchableOrder,
  field: OrderSearchField,
  term: string,
): boolean {
  const needle = normalize(term);
  if (needle === '') return true;
  // No `default:` — TS treats a switch covering every member of a string-literal union as
  // exhaustive, so a 5th chip added later fails to compile here instead of silently
  // falling into the customer branch.
  switch (field) {
    case 'customer':
      return matchesCustomer(order, needle);
    case 'orderNo':
      return matchesOrderNo(order, needle);
    case 'product':
      return matchesProduct(order, needle);
    // '전체' = OR across all three (PLAN 2609_27 D4).
    case 'all':
      return matchesCustomer(order, needle)
        || matchesOrderNo(order, needle)
        || matchesProduct(order, needle);
  }
}
