import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CreateCommissionRateRequest } from '@/application/dto/CreateCommissionRateRequest';

export interface CommissionRateRepository {
  getCommissionRates(): Promise<CommissionRate[]>;
  createCommissionRate(request: CreateCommissionRateRequest): Promise<CommissionRate>;
}
