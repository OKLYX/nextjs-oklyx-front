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
  PurchaseCheckRequest,
} from '@/application/dto/PurchaseListDTOs';

export class PurchaseListUseCase {
  constructor(private repository: PurchaseListRepository) {}

  async getList(sellerId?: number): Promise<PurchaseList> {
    return this.repository.getPurchaseList(sellerId);
  }

  async getCompletedList(from?: string, to?: string, sellerId?: number): Promise<PurchaseListItem[]> {
    return this.repository.getCompletedList(from, to, sellerId);
  }

  async extract(): Promise<PurchaseList> {
    return this.repository.extractPurchaseList();
  }

  async recordPurchase(request: RecordPurchaseRequest): Promise<PurchaseRecordResult> {
    return this.repository.recordPurchase(request);
  }

  async getRecentPurchases(productId: number, limit: number, sellerId?: number): Promise<PurchaseRecord[]> {
    return this.repository.getRecentPurchases(productId, limit, sellerId);
  }

  async addManualItem(request: AddManualItemRequest): Promise<void> {
    return this.repository.addManualItem(request);
  }

  async adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void> {
    return this.repository.adjustManualQty(itemId, request);
  }

  async changeManualSeller(itemId: number, sellerId: number): Promise<void> {
    return this.repository.changeManualSeller(itemId, sellerId);
  }

  async deleteManualItem(itemId: number): Promise<void> {
    return this.repository.deleteManualItem(itemId);
  }

  async check(request: PurchaseCheckRequest): Promise<void> {
    return this.repository.check(request);
  }

  async cancelCheck(checkId: number): Promise<void> {
    return this.repository.cancelCheck(checkId);
  }
}
