import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PurchaseReceiptRepository } from '@/domain/repositories/PurchaseReceiptRepository';
import type { ReceiptDetail, ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import type {
  CreateReceiptRequest,
  ReceiptListParams,
  UpdateReceiptRequest,
} from '@/application/dto/PurchaseReceiptDTOs';

export class PurchaseReceiptRepositoryImpl implements PurchaseReceiptRepository {
  async create(photo: File, request: CreateReceiptRequest): Promise<number> {
    const formData = new FormData();
    formData.append('photo', photo);
    // The server reads this part as JSON (@RequestPart) — it needs the application/json type.
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    const response = await axiosInstance.post('/api/admin/purchase-receipts', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data.receiptId;
  }

  async search(params: ReceiptListParams): Promise<ReceiptSummary[]> {
    const response = await axiosInstance.get('/api/admin/purchase-receipts', { params });
    return response.data.data;
  }

  async get(receiptId: number): Promise<ReceiptDetail> {
    const response = await axiosInstance.get(`/api/admin/purchase-receipts/${receiptId}`);
    return response.data.data;
  }

  async update(receiptId: number, request: UpdateReceiptRequest): Promise<ReceiptDetail> {
    const response = await axiosInstance.put(`/api/admin/purchase-receipts/${receiptId}`, request);
    return response.data.data;
  }
}
