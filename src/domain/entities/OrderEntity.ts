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
  status: string;
  paidAt: string | null;
}

// Maps Coupang order status codes to Korean display labels
const ORDER_STATUS_LABELS: Record<string, string> = {
  ACCEPT: '결제완료',
  INSTRUCT: '상품준비중',
  DEPARTURE: '배송지시',
  DELIVERING: '배송중',
  FINAL_DELIVERY: '배송완료',
  NONE_TRACKING: '추적불가',   // long explanation lives under the status filter chip (OrderContainer)
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

// Order status codes in workflow sequence; used for the status filter buttons
export const ORDER_STATUSES = [
  'ACCEPT',
  'INSTRUCT',
  'DEPARTURE',
  'DELIVERING',
  'FINAL_DELIVERY',
  'NONE_TRACKING',
] as const;

// Virtual filter key for fully-canceled orders. Coupang keeps the raw status
// (e.g. ACCEPT) even when an order is fully canceled, so this is not a real
// status code — it is a derived filter surfaced as its own chip.
export const CANCELED_FILTER = 'CANCELED';

// True when the whole order was canceled: cancelCount equals orderCount (and > 0).
// A partial cancel (cancelCount < orderCount) stays under its normal status.
export function isFullyCanceled(order: Pick<OrderItem, 'orderCount' | 'cancelCount'>): boolean {
  return order.cancelCount > 0 && order.cancelCount === order.orderCount;
}
