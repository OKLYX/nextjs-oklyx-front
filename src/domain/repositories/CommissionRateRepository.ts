import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { CreateCommissionRateRequest } from '@/application/dto/CreateCommissionRateRequest';
import type { UpdateCommissionRateRequest } from '@/application/dto/UpdateCommissionRateRequest';

export interface CommissionRateRepository {
  getCommissionRates(): Promise<CommissionRate[]>;
  createCommissionRate(request: CreateCommissionRateRequest): Promise<CommissionRate>;
  updateCommissionRate(id: number, request: UpdateCommissionRateRequest): Promise<CommissionRate>;
  deleteCommissionRate(id: number): Promise<void>;
}
