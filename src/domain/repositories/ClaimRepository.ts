import type {
  Claim,
  ClaimActionPayload,
  ClaimActionResult,
  ClaimType,
} from '@/domain/entities/ClaimEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';

export interface ClaimListParams {
  type: ClaimType;
  sellerId?: number;
  keyword?: string;
  period?: OrderPeriodRange;     // undefined = server default window (recent 14 days)
}

/**
 * The list still carries the whole record (list and detail return the same shape) and the status
 * chips stay a client-side filter — but a processing action changes the server's answer, so
 * `getClaim` re-reads that one claim afterwards (2609_21 D8). Re-reading the *list* is not an
 * option: it would throw away the user's filter, page and scroll.
 */
export interface ClaimRepository {
  getClaims(params: ClaimListParams): Promise<Claim[]>;
  getClaim(id: number): Promise<Claim>;
  executeAction(claimId: number, payload: ClaimActionPayload): Promise<ClaimActionResult>;
}
