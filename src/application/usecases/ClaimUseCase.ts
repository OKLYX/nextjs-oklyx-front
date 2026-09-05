import type { ClaimListParams, ClaimRepository } from '@/domain/repositories/ClaimRepository';
import type { Claim } from '@/domain/entities/ClaimEntity';

export class ClaimUseCase {
  constructor(private repository: ClaimRepository) {}

  async getClaims(params: ClaimListParams): Promise<Claim[]> {
    return this.repository.getClaims(params);
  }
}
