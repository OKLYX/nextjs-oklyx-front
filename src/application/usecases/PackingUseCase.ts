import type { PackingRepository } from '@/domain/repositories/PackingRepository';
import type {
  BarcodeLookupResult,
  BoxCandidate,
  BoxCandidateItem,
  PackingCloseResult,
  PackingCompleteResult,
  PackingScanResponse,
  ParcelCompleteRequest,
  PendingParcel,
} from '@/domain/entities/PackingEntity';

/** 포장 콘솔 usecase — 얇은 위임 (FEATURE_2609_40) */
export class PackingUseCase {
  constructor(private repository: PackingRepository) {}

  async scan(invoiceNumber: string): Promise<PackingScanResponse> {
    return this.repository.scan(invoiceNumber);
  }

  async pending(sellerId?: number): Promise<PendingParcel[]> {
    return this.repository.pending(sellerId);
  }

  async lookupBarcode(value: string, parcelId: number): Promise<BarcodeLookupResult> {
    return this.repository.lookupBarcode(value, parcelId);
  }

  async boxCandidates(items: BoxCandidateItem[]): Promise<BoxCandidate[]> {
    return this.repository.boxCandidates(items);
  }

  async complete(
    parcelId: number,
    request: ParcelCompleteRequest
  ): Promise<PackingCompleteResult> {
    return this.repository.complete(parcelId, request);
  }

  async markUnused(parcelId: number): Promise<PackingCloseResult> {
    return this.repository.markUnused(parcelId);
  }
}
