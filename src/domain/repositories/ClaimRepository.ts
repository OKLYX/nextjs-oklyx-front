import type { Claim, ClaimType } from '@/domain/entities/ClaimEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';

export interface ClaimListParams {
  type: ClaimType;
  sellerId?: number;
  keyword?: string;
  period?: OrderPeriodRange;     // undefined = server default window (recent 14 days)
}

// List only on purpose: the details modal reuses the row object (the server returns the same
// record for list and detail), and the status chips are a client-side filter.
export interface ClaimRepository {
  getClaims(params: ClaimListParams): Promise<Claim[]>;
}
