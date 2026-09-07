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

export interface OrderItem {
  id: number;
  marketplaceAccountId: number;
  platform: string;
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
  // 플랫폼 원문 상태(쿠팡 ACCEPT·NONE_TRACKING 등). 거울 행이 없으면 null.
  // 표시 보조 용도로만 쓴다 — 화면 판정은 중립 `status` 로만 한다.
  platformStatus: string | null;
  // 전량 취소 여부 — 서버 판정(cancelCount + holdCount >= orderCount)이 유일한 기준이다.
  cancelled: boolean;
  paidAt: string | null;
  // 주문 시점 금액 스냅샷. 과거 주문은 백필된 만큼만 채워져 null 이 온다 — 0 으로 그리지 말 것.
  unitPrice: number | null;
  lineAmount: number | null;              // 할인 전 라인 합계
  discountAmount: number | null;          // 총 할인
  platformDiscountAmount: number | null;  // 플랫폼 부담 할인
}

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
