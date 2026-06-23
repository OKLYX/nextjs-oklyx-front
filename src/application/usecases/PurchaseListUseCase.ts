import type { PurchaseListRepository } from '@/domain/repositories/PurchaseListRepository';
import type { PurchaseList, PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type {
  RecordPurchaseRequest,
  AddManualItemRequest,
  AdjustManualQtyRequest,
} from '@/application/dto/PurchaseListDTOs';

export class PurchaseListUseCase {
  constructor(private repository: PurchaseListRepository) {}

  async getList(sellerId?: number): Promise<PurchaseList> {
    return this.repository.getPurchaseList(sellerId);
  }

  async getCompletedList(
    sellerId?: number,
    from?: string,
    to?: string
  ): Promise<PurchaseListItem[]> {
    return this.repository.getCompletedList(sellerId, from, to);
  }

  async extract(sellerId?: number): Promise<PurchaseList> {
    return this.repository.extractPurchaseList(sellerId);
  }

  async recordPurchase(itemId: number, request: RecordPurchaseRequest): Promise<void> {
    return this.repository.recordPurchase(itemId, request);
  }

  async addManualItem(request: AddManualItemRequest): Promise<void> {
    return this.repository.addManualItem(request);
  }

  async adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void> {
    return this.repository.adjustManualQty(itemId, request);
  }
}
