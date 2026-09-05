import type { ClaimListParams, ClaimRepository } from '@/domain/repositories/ClaimRepository';
import type {
  Claim,
  ClaimActionPayload,
  ClaimActionResult,
} from '@/domain/entities/ClaimEntity';

export class ClaimUseCase {
  constructor(private repository: ClaimRepository) {}

  async getClaims(params: ClaimListParams): Promise<Claim[]> {
    return this.repository.getClaims(params);
  }

  async getClaim(id: number): Promise<Claim> {
    return this.repository.getClaim(id);
  }

  async executeAction(claimId: number, payload: ClaimActionPayload): Promise<ClaimActionResult> {
    return this.repository.executeAction(claimId, payload);
  }
}
