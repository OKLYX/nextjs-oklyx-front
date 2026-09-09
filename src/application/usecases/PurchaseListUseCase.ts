import type { PurchaseListRepository } from '@/domain/repositories/PurchaseListRepository';
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

export class PurchaseListUseCase {
  constructor(private repository: PurchaseListRepository) {}

  async getList(): Promise<PurchaseList> {
    return this.repository.getPurchaseList();
  }

  async getCompletedList(from?: string, to?: string): Promise<PurchaseListItem[]> {
    return this.repository.getCompletedList(from, to);
  }

  async extract(): Promise<PurchaseList> {
    return this.repository.extractPurchaseList();
  }

  async recordPurchase(request: RecordPurchaseRequest): Promise<PurchaseRecordResult> {
    return this.repository.recordPurchase(request);
  }

  async getRecentPurchases(productId: number, limit: number): Promise<PurchaseRecord[]> {
    return this.repository.getRecentPurchases(productId, limit);
  }

  async addManualItem(request: AddManualItemRequest): Promise<void> {
    return this.repository.addManualItem(request);
  }

  async adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void> {
    return this.repository.adjustManualQty(itemId, request);
  }
}
