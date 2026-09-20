import type { BarcodeExtractionResult } from '@/domain/entities/BarcodeExtraction';
import type { BarcodeExtractionRepository } from '@/domain/repositories/BarcodeExtractionRepository';

// Thin delegation over the barcode extraction endpoint (FEATURE_2609_65).
// Create as `new BarcodeExtractionUseCase(new BarcodeExtractionRepositoryImpl())`
// in a container (useMemo) and inject into the detail view / list toolbar.
// 🔴 Do not add status judgement here — the server owns every status (PLAN D12).
export class BarcodeExtractionUseCase {
  constructor(private repository: BarcodeExtractionRepository) {}

  extract(productIds: number[], overwrite: boolean): Promise<BarcodeExtractionResult> {
    return this.repository.extract(productIds, overwrite);
  }
}
