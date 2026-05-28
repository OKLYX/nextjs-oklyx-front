import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';

export interface CommissionRateRepository {
  getCommissionRates(): Promise<CommissionRate[]>;
}
