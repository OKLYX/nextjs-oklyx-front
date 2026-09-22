import type {
  Claim,
  ClaimActionPayload,
  ClaimActionResult,
  ClaimSyncResult,
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
  /**
   * 채널 1개의 반품·교환을 마켓에서 다시 가져온다(FEATURE_2609_70 / D14). 클레임만 보려고 주문
   * 동기화 전체를 돌리지 않기 위한 입구다.
   * ⚠️ 채널을 하나씩 부른다 — 여러 채널을 한 번에 도는 경로를 만들지 않는다(진행 상황을 그려야 한다).
   */
  syncClaims(accountId: number): Promise<ClaimSyncResult>;
}
