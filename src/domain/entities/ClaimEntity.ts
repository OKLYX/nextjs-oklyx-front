// Claim (return/exchange) domain types — GET /api/claims (FEATURE_2609_18).
// Stage A is returns only; exchange lands with 07.

export type ClaimType = 'RETURN' | 'EXCHANGE';

export type ClaimStatus =
  | 'RECEIVED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' | 'WITHDRAWN' | 'PENDING_REVIEW' | 'STALE';

export interface Claim {
  id: number;
  platform: string;              // 'COUPANG' — D5. Display only for now; 07+ branches actions on it
  claimType: ClaimType;
  status: ClaimStatus;
  platformStatus: string;        // raw marketplace status ('UC' etc.) — details modal only
  externalClaimId: string;
  externalOrderId: string;
  itemName: string | null;
  quantity: number;
  reasonCode: string | null;
  reasonText: string | null;
  faultType: string | null;
  returnShippingCharge: number | null;
  collectInvoiceNo: string | null;
  collectCarrierCode: string | null;
  requesterName: string | null;
  receivedAt: string;            // ISO
  sellerId: number | null;
  sellerName: string | null;
  orderItemId: number | null;
  linked: boolean;               // false = not linked to an order line (D12)
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  RECEIVED: '접수', IN_PROGRESS: '진행중', DONE: '완료', REJECTED: '거부',
  WITHDRAWN: '철회', PENDING_REVIEW: '확인요청', STALE: '확인필요',
};

/**
 * Only the statuses returns actually produce get a chip (PLAN §3.1). Exchange statuses come with 07.
 * ⚠️ `STALE` has zero rows until 05 (tracking) creates them, so it is not a chip yet — add it here
 * when 05 starts. Until then STALE rows are only visible under `전체`.
 */
export const RETURN_STATUS_FILTERS: ClaimStatus[] = ['RECEIVED', 'DONE', 'PENDING_REVIEW'];

/**
 * Fault code → Korean label. **Starts empty on purpose** — Coupang's actual `faultByType` value set
 * is not confirmed yet, and a guessed mapping would show wrong labels. Fill it in once dev responses
 * confirm the values. Until then (and for any unmapped value afterwards) the screen shows the raw
 * value — it must never render blank.
 */
export const FAULT_TYPE_LABEL: Record<string, string> = {};

/**
 * ⚠️ Always render fault through this — never read FAULT_TYPE_LABEL[x] directly in a component:
 * an unmapped value would come back `undefined` and paint an empty cell.
 * Mobile (03) uses the same policy so web and app never disagree on fault text.
 */
export const faultTypeText = (v: string | null): string => (v ? FAULT_TYPE_LABEL[v] ?? v : '-');
