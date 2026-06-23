import type { PurchaseList, PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type {
  RecordPurchaseRequest,
  AddManualItemRequest,
  AdjustManualQtyRequest,
} from '@/application/dto/PurchaseListDTOs';

export interface PurchaseListRepository {
  getPurchaseList(sellerId?: number): Promise<PurchaseList>;
  // Completed purchases (remainingQty <= 0 && purchasedQty > 0), flat product list, no pagination.
  // sellerId filters by order line's seller (manual lines excluded); from/to filter by purchase date (ISO yyyy-MM-dd, inclusive).
  getCompletedList(sellerId?: number, from?: string, to?: string): Promise<PurchaseListItem[]>;
  extractPurchaseList(sellerId?: number): Promise<PurchaseList>;
  recordPurchase(itemId: number, request: RecordPurchaseRequest): Promise<void>;
  addManualItem(request: AddManualItemRequest): Promise<void>;
  adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void>;
}
