export type PurchaseLineSource = 'ORDER' | 'MANUAL';

/**
 * 최근 구매이력 한 줄 (PLAN 2609_29 D9).
 *
 * ⚠️ 물품 기준 조회라 판매자가 섞여 나온다 — 각 줄이 누구 것인지 보이도록 sellerName 을 함께 그린다.
 * 금액은 FEATURE_2609_28 이전에 기록된 행에서 null 이다 — "금액 미상"이며 0 이 아니다.
 */
export interface PurchaseRecord {
  id: number;
  purchasedOn: string;
  quantity: number;
  totalAmount: number | null;
  unitPrice: number | null;
  reflectToBasePrice: boolean;
  sellerName: string;
}

/**
 * 그룹 토글 안에 보이는 기여 라인 1개 (PLAN 2609_29 D7·D8).
 *
 * ⚠️ 라인에는 구매수량도 구매이력도 없다 — 구매기록이 주문 라인을 모른다(D3).
 * 수동 라인은 orderLineId·externalOrderId 와 채널 3필드가 전부 null 이며 화면에서 "수동"으로 그린다.
 */
export interface PurchaseListLine {
  itemId: number;
  orderLineId: number | null;
  source: PurchaseLineSource;
  externalOrderId: string | null;
  marketplaceAccountId: number | null;
  sellerName: string | null;
  platform: string | null;
  autoQty: number;
  manualQty: number;
  neededQty: number;
}

export interface PurchaseListItem {
  productId: number;
  productName: string;
  neededQty: number;
  purchasedQty: number;
  remainingQty: number;
  lines: PurchaseListLine[];
}

export interface UnmappedOrder {
  externalItemId: string;
  itemName: string;
  purchasableQty: number;
  orderCount: number;
}

export interface PurchaseList {
  items: PurchaseListItem[];
  unmappedOrders: UnmappedOrder[];
}
