import type { ReceiptDetail, ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import type {
  CreateReceiptRequest,
  ReceiptCreateResult,
  ReceiptListParams,
  UpdateReceiptRequest,
} from '@/application/dto/PurchaseReceiptDTOs';

// Receipt check-in = photo + JSON in one multipart request (FEATURE_2610_18 D76). Returns the new receipt id and the
// stock rows its lines wrote (FEATURE_2611_22 D3 ①).
// update = the header edit (D100); it returns the receipt as saved. attachPhoto = the photo of a 「영수증 나중에」 receipt
// (FEATURE_2611_01 D4); it returns the receipt as saved.
export interface PurchaseReceiptRepository {
  create(photo: File, request: CreateReceiptRequest): Promise<ReceiptCreateResult>;
  search(params: ReceiptListParams): Promise<ReceiptSummary[]>;
  get(receiptId: number): Promise<ReceiptDetail>;
  update(receiptId: number, request: UpdateReceiptRequest): Promise<ReceiptDetail>;
  attachPhoto(receiptId: number, photo: File): Promise<ReceiptDetail>;
}
