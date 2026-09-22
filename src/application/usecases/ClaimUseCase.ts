import type { ClaimListParams, ClaimRepository } from '@/domain/repositories/ClaimRepository';
import type {
  Claim,
  ClaimActionPayload,
  ClaimActionResult,
  ClaimSyncResult,
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

  /** 채널 1개의 반품·교환만 다시 가져오기 (D14). 채널 루프는 화면이 돈다. */
  async syncClaims(accountId: number): Promise<ClaimSyncResult> {
    return this.repository.syncClaims(accountId);
  }
}
