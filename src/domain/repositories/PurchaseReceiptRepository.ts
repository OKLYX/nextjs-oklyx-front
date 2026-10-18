import type { ReceiptDetail, ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import type {
  CreateReceiptRequest,
  ReceiptListParams,
  UpdateReceiptRequest,
} from '@/application/dto/PurchaseReceiptDTOs';

// Receipt check-in = photo + JSON in one multipart request (FEATURE_2610_18 D76). Returns the new receipt id.
// update = the header edit (D100); it returns the receipt as saved.
export interface PurchaseReceiptRepository {
  create(photo: File, request: CreateReceiptRequest): Promise<number>;
  search(params: ReceiptListParams): Promise<ReceiptSummary[]>;
  get(receiptId: number): Promise<ReceiptDetail>;
  update(receiptId: number, request: UpdateReceiptRequest): Promise<ReceiptDetail>;
}
