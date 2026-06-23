import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PurchaseListRepository } from '@/domain/repositories/PurchaseListRepository';
import type { PurchaseList, PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type {
  RecordPurchaseRequest,
  AddManualItemRequest,
  AdjustManualQtyRequest,
} from '@/application/dto/PurchaseListDTOs';

export class PurchaseListRepositoryImpl implements PurchaseListRepository {
  async getPurchaseList(sellerId?: number): Promise<PurchaseList> {
    const response = await axiosInstance.get('/api/admin/purchase-list', {
      params: sellerId != null ? { sellerId } : {},
    });
    return response.data.data;
  }

  async getCompletedList(
    sellerId?: number,
    from?: string,
    to?: string
  ): Promise<PurchaseListItem[]> {
    const params: Record<string, string | number> = {};
    if (sellerId != null) params.sellerId = sellerId;
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await axiosInstance.get('/api/admin/purchase-list/completed', { params });
    return response.data.data;
  }

  async extractPurchaseList(sellerId?: number): Promise<PurchaseList> {
    const response = await axiosInstance.post('/api/admin/purchase-list/extract', null, {
      params: sellerId != null ? { sellerId } : {},
    });
    return response.data.data;
  }

  async recordPurchase(itemId: number, request: RecordPurchaseRequest): Promise<void> {
    await axiosInstance.post(`/api/admin/purchase-list/items/${itemId}/purchases`, request);
  }

  async addManualItem(request: AddManualItemRequest): Promise<void> {
    await axiosInstance.post('/api/admin/purchase-list/manual', request);
  }

  async adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void> {
    await axiosInstance.patch(`/api/admin/purchase-list/items/${itemId}`, request);
  }
}
