export interface OrderItem {
  id: number;
  marketplaceAccountId: number;
  platform: string;
  externalOrderId: string;
  externalBoxId: string | null;
  externalItemId: string;
  itemName: string | null;
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
  NONE_TRACKING: '업체 직접 배송(배송 연동 미적용), 추적불가',
};

// Returns the Korean label for an order status code; falls back to the raw value
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
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
