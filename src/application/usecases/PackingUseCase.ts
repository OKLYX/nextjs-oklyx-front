import type { PackingRepository } from '@/domain/repositories/PackingRepository';
import type {
  BarcodeLookupResult,
  BoxCandidate,
  BoxCandidateItem,
  PackingCloseResult,
  PackingCompleteResult,
  PackingHistoryQuery,
  PackingHistoryRow,
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

  async restore(parcelId: number): Promise<PackingCloseResult> {
    return this.repository.restore(parcelId);
  }

  async history(query: PackingHistoryQuery): Promise<PackingHistoryRow[]> {
    return this.repository.history(query);
  }

  /** Changes the box of a packed parcel (FEATURE_2611_06 / D8) */
  async changeBox(parcelId: number, boxPackageId: number): Promise<PackingCompleteResult> {
    return this.repository.changeBox(parcelId, boxPackageId);
  }
}
