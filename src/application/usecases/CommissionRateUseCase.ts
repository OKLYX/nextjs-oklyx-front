import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CommissionRateRepository } from '@/domain/repositories/CommissionRateRepository';
import type { CreateCommissionRateRequest } from '@/application/dto/CreateCommissionRateRequest';

export class CommissionRateUseCase {
  constructor(private repository: CommissionRateRepository) {}

  async getCommissionRates(): Promise<CommissionRate[]> {
    return this.repository.getCommissionRates();
  }

  async createCommissionRate(request: CreateCommissionRateRequest): Promise<CommissionRate> {
    return this.repository.createCommissionRate(request);
  }
}
