// Claim (return/exchange) domain types — GET /api/claims (FEATURE_2609_18).
// Shared by both claim types: the screen is one list with a 반품/교환 tab.

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
  reshipInvoiceNo: string | null;    // exchange only — reshipment (seller → customer) invoice
  reshipCarrierCode: string | null;  // exchange only
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

/** The single naming table shared by the tab labels, empty-state wording and the modal title. */
export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = { RETURN: '반품', EXCHANGE: '교환' };

/**
 * Only the statuses returns actually produce get a chip (PLAN §3.1) — exchange has its own list
 * in `EXCHANGE_STATUS_FILTERS` below, and the two differing is intentional.
 * Returns now also produce `IN_PROGRESS` (입고완료, from the corrected receiptStatus mapping),
 * `WITHDRAWN` (closed from the withdrawal history) and `STALE` (forced close by tracking).
 */
export const RETURN_STATUS_FILTERS: ClaimStatus[] = [
  'RECEIVED', 'IN_PROGRESS', 'DONE', 'PENDING_REVIEW', 'WITHDRAWN', 'STALE',
];

/**
 * Only the statuses exchanges actually produce (PLAN §3.1). `PENDING_REVIEW` is returns-only, so
 * it is absent here on purpose.
 */
export const EXCHANGE_STATUS_FILTERS: ClaimStatus[] = [
  'RECEIVED', 'IN_PROGRESS', 'DONE', 'REJECTED', 'WITHDRAWN', 'STALE',
];

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
