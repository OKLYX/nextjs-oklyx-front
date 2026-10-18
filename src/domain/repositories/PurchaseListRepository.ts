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
  PurchaseCheckRequest,
} from '@/application/dto/PurchaseListDTOs';

// 🔴 sellerId is a view filter on the reads only — the extract takes none (FEATURE_2610_09 D4 · D19).
export interface PurchaseListRepository {
  getPurchaseList(sellerId?: number): Promise<PurchaseList>;
  // Completed rows (every share processed, FEATURE_2610_09 D57 · D78), flat product list, no pagination.
  // from/to filter by processing day (ISO yyyy-MM-dd, inclusive).
  getCompletedList(from?: string, to?: string, sellerId?: number): Promise<PurchaseListItem[]>;
  extractPurchaseList(): Promise<PurchaseList>;
  // One check-in = purchase record + stock check-in while the stock link is on (PLAN 2609_29 D1 · FEATURE_2610_09 D65).
  // Product × seller.
  recordPurchase(request: RecordPurchaseRequest): Promise<PurchaseRecordResult>;
  // Recent purchases of a product; sellerId omitted = every seller (FEATURE_2610_09 D7 · D25).
  getRecentPurchases(productId: number, limit: number, sellerId?: number): Promise<PurchaseRecord[]>;
  addManualItem(request: AddManualItemRequest): Promise<void>;
  adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void>;
  changeManualSeller(itemId: number, sellerId: number): Promise<void>;
  deleteManualItem(itemId: number): Promise<void>;
  check(request: PurchaseCheckRequest): Promise<void>;
  cancelCheck(checkId: number): Promise<void>;
}
