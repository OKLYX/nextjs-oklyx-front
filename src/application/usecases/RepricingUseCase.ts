import type { RepricingRepository } from '@/domain/repositories/RepricingRepository';
import type {
  RecalculateResult,
  RepricePushResult,
  RepricingCandidatesParams,
  RepricingCandidatesResponse,
} from '@/domain/entities/RepricingEntity';

export class RepricingUseCase {
  constructor(private repository: RepricingRepository) {}

  candidates(params: RepricingCandidatesParams): Promise<RepricingCandidatesResponse> {
    return this.repository.candidates(params);
  }

  recalculate(listingIds: number[]): Promise<RecalculateResult> {
    return this.repository.recalculate(listingIds);
  }

  push(optionIds: number[]): Promise<RepricePushResult> {
    return this.repository.push(optionIds);
  }
}
