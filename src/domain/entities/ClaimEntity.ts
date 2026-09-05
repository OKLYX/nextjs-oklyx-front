// Claim (return/exchange) domain types — GET /api/claims (FEATURE_2609_18).
// Shared by both claim types: the screen is one list with a 반품/교환 tab.

export type ClaimType = 'RETURN' | 'EXCHANGE';

export type ClaimStatus =
  | 'RECEIVED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' | 'WITHDRAWN' | 'PENDING_REVIEW' | 'STALE';

export interface Claim {
  id: number;
  platform: string;              // 'COUPANG' — D5. Display + carrier-option lookup only:
                                 // the action list comes from `availableActions`, so the screen
                                 // never branches on the platform (2609_21 D1).
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
  collectStatus?: string | null;     // exchange only — raw platform value (05). Optional: an older
                                     // server response has no such field at all (undefined).
  reshipInvoiceNo: string | null;    // exchange only — reshipment (seller → customer) invoice
  reshipCarrierCode: string | null;  // exchange only
  requesterName: string | null;
  receivedAt: string;            // ISO
  sellerId: number | null;
  sellerName: string | null;
  orderItemId: number | null;
  linked: boolean;               // false = not linked to an order line (D12)
  availableActions: ClaimAction[];   // server-decided; empty for non-ADMIN, unsupported platforms
                                     // and claims with nothing to do (never null)
}

// --- Processing actions (FEATURE_2609_21) ---
// 🔴 The server decides what can be pressed. There is no client-side action table, no label map and
// no `platform === 'COUPANG'` branch here: adding one means every new marketplace edits the screen.

/** Action identifiers — echoed back to the server verbatim. 교환 4값은 06 이 쓴다(D14). */
export type ClaimActionCode =
  | 'RETURN_RECEIVE_CONFIRM' | 'RETURN_APPROVE' | 'RETURN_COLLECT_INVOICE'
  | 'EXCHANGE_RECEIVE_CONFIRM' | 'EXCHANGE_REJECT'
  | 'EXCHANGE_RESHIP_INVOICE' | 'EXCHANGE_COLLECT_INVOICE';

/**
 * Extra input the action needs. ⚠️ An unknown value must hide the button — the screen cannot build
 * a form it does not know (PLAN §8). That is the whole forward-compatibility story for new
 * marketplaces, so never widen this to `string` and never `switch` on `ClaimActionCode` instead.
 */
export type ClaimActionRequires = 'NONE' | 'INVOICE' | 'REJECT_CODE';

/** A value choice for actions that require one (D19) — 반품 3액션은 항상 빈 배열. */
export interface ActionChoice {
  code: string;
  label: string;
}

export interface ClaimAction {
  action: ClaimActionCode;
  label: string;               // server-authored display name — never re-derived here (D18)
  requires: ClaimActionRequires;
  choices: ActionChoice[];     // only filled when `requires` asks for a value (06 uses it)
  irreversible: boolean;       // drives the two-step confirm (D10)
}

/**
 * Action request body — POST /api/admin/claims/{id}/actions.
 *
 * ⚠️ 택배사는 **마켓 코드 자체**(`deliveryCompanyCode`)로 보낸다. 로컬 carrier PK 가 아니다 —
 * 쿠팡은 택배사 목록 API 가 없고 문서 코드표가 SSOT 라 대부분의 택배사에 붙일 로컬 id 가 없다
 * (2609_11 D2 개정 2026-09-03, 단건 발송처리와 같은 계약). 드롭다운도 같은 원천을 쓴다:
 * `ShippingLabelUseCase.getCarrierOptions(platform)`.
 *
 * `regNumber` 는 쿠팡 선택 필드라 UI 가 보내지 않는다 — 계약을 모바일과 맞추려고 타입에만 둔다.
 */
export interface ClaimActionPayload {
  action: ClaimActionCode;
  deliveryCompanyCode?: string;
  invoiceNumber?: string;
  regNumber?: string;
  rejectCode?: string;         // 06 에서 사용
}

/**
 * Action result. `succeeded` is always `true` on a 200 — a marketplace rejection arrives as 502
 * with this same shape in `data` — so never branch on it. It exists so web, mobile and the audit
 * table read one contract.
 * ⚠️ `resultMessage` is the marketplace's raw text (D15): show it, never translate or summarise it.
 */
export interface ClaimActionResult {
  claimId: number;
  action: ClaimActionCode;
  succeeded: boolean;
  resultCode: string | null;
  resultMessage: string | null;
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

/**
 * Exchange collect status (raw Coupang value) → Korean label — **display only** (FEATURE_2609_21 / 06).
 *
 * ⚠️ This is not a D19 violation: D19 bans code→label constants for values the screen **sends back**
 * (the reject reason, which the server owns through `choices`). `collectStatus` is never sent
 * anywhere, and the server deliberately ships the raw value (05 Step 1), so an unmapped value only
 * looks a little rough on screen — it can never reach the marketplace.
 */
export const COLLECT_STATUS_LABEL: Record<string, string> = {
  BeforeDirection: '회수 연동 전',
  CompleteCollect: '업체 전달 완료',
};

/**
 * ⚠️ Same rule as {@link faultTypeText} — always render through this, never read
 * COLLECT_STATUS_LABEL[x] in a component: an unmapped value comes back `undefined` and paints an
 * empty cell. Returns only ever have `null` here, so the 반품 detail must not show the row at all.
 */
export const collectStatusText = (v?: string | null): string =>
  v ? COLLECT_STATUS_LABEL[v] ?? v : '-';
