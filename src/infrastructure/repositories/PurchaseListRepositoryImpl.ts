import { axiosInstance } from '@/infrastructure/api/axiosInstance';
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

export class PurchaseListRepositoryImpl implements PurchaseListRepository {
  async getPurchaseList(): Promise<PurchaseList> {
    const response = await axiosInstance.get('/api/admin/purchase-list');
    return response.data.data;
  }

  async getCompletedList(from?: string, to?: string): Promise<PurchaseListItem[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await axiosInstance.get('/api/admin/purchase-list/completed', { params });
    return response.data.data;
  }

  async extractPurchaseList(): Promise<PurchaseList> {
    const response = await axiosInstance.post('/api/admin/purchase-list/extract');
    return response.data.data;
  }

  async recordPurchase(request: RecordPurchaseRequest): Promise<PurchaseRecordResult> {
    const response = await axiosInstance.post('/api/admin/purchase-list/purchases', request);
    return response.data.data;
  }

  async getRecentPurchases(productId: number, limit: number): Promise<PurchaseRecord[]> {
    const response = await axiosInstance.get('/api/admin/purchase-list/purchases', {
      params: { productId, limit },
    });
    return response.data.data;
  }

  async addManualItem(request: AddManualItemRequest): Promise<void> {
    await axiosInstance.post('/api/admin/purchase-list/manual', request);
  }

  async adjustManualQty(itemId: number, request: AdjustManualQtyRequest): Promise<void> {
    await axiosInstance.patch(`/api/admin/purchase-list/items/${itemId}`, request);
  }
}
