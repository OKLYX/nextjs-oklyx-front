import type { PriceHistoryRepository } from '@/domain/repositories/PriceHistoryRepository';
import type { PriceChangeRow, PriceHistoryParams } from '@/domain/entities/PriceHistoryEntity';

export class PriceHistoryUseCase {
  constructor(private repository: PriceHistoryRepository) {}

  search(params: PriceHistoryParams): Promise<PriceChangeRow[]> {
    return this.repository.search(params);
  }
}
