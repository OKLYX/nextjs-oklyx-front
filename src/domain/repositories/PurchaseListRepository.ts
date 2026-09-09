import type {
  PurchaseList,
  PurchaseListItem,
  PurchaseRecord,
} from '@/domain/entities/PurchaseListEntity';
import type {
  RecordPurchaseRequest,
  PurchaseRecordResult,
  AddManualItemRequest,
  AdjustManualQtyRequest,
} from '@/application/dto/PurchaseListDTOs';

// 🔴 조회·추출에 판매자 파라미터가 없다(PLAN 2609_29 D11) — 항상 전체다.
export interface PurchaseListRepository {
  getPurchaseList(): Promise<PurchaseList>;
  // Completed purchases (remainingQty <= 0 && purchasedQty > 0), flat product list, no pagination.
  // from/to filter by purchase date (ISO yyyy-MM-dd, inclusive).
  getCompletedList(from?: string, to?: string): Promise<PurchaseListItem[]>;
  extractPurchaseList(): Promise<PurchaseList>;
  // 입고 1회 = 구매기록 + 재고 입고(PLAN 2609_29 D1). 물품 × 판매자 단위.
  recordPurchase(request: RecordPurchaseRequest): Promise<PurchaseRecordResult>;
  // 그 물품의 최근 구매이력. ⚠️ 판매자 조건 없음(D9).
  getRecentPurchases(productId: number, limit: number): Promise<PurchaseRecord[]>;
  addManualItem(request: AddManualItemRequest): Promise<void>;
  adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void>;
}
