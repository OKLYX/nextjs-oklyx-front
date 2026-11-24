import type { StockWorkRepository } from '@/domain/repositories/StockWorkRepository';
import type { OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';

/** Stock work screens (FEATURE_2611_34). Thin delegation to the repository. */
export class StockWorkUseCase {
  constructor(private repository: StockWorkRepository) {}

  outboundWork(request: OutboundWorkRequest): Promise<void> {
    return this.repository.outboundWork(request);
  }
}
