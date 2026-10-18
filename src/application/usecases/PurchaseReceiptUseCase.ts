import type { PurchaseReceiptRepository } from '@/domain/repositories/PurchaseReceiptRepository';
import type { ReceiptDetail, ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import type {
  CreateReceiptRequest,
  ReceiptListParams,
  UpdateReceiptRequest,
} from '@/application/dto/PurchaseReceiptDTOs';

export class PurchaseReceiptUseCase {
  constructor(private repository: PurchaseReceiptRepository) {}

  async create(photo: File, request: CreateReceiptRequest): Promise<number> {
    return this.repository.create(photo, request);
  }

  async search(params: ReceiptListParams): Promise<ReceiptSummary[]> {
    return this.repository.search(params);
  }

  async get(receiptId: number): Promise<ReceiptDetail> {
    return this.repository.get(receiptId);
  }

  async update(receiptId: number, request: UpdateReceiptRequest): Promise<ReceiptDetail> {
    return this.repository.update(receiptId, request);
  }
}
