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
