import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CommissionRateRepository } from '@/domain/repositories/CommissionRateRepository';

export class CommissionRateUseCase {
  constructor(private repository: CommissionRateRepository) {}

  async getCommissionRates(): Promise<CommissionRate[]> {
    return this.repository.getCommissionRates();
  }
}
