// Customer inquiry domain types — GET /api/inquiries (FEATURE_2609_23).
// One list holds every inquiry kind: the type tab is a server axis, not a separate screen.

/**
 * ⚠️ Never narrow this to a union of literals. The set of types a platform supports comes from
 * `GET /api/inquiries/types` (D4) — a client-side type table is exactly what makes every new
 * marketplace edit this screen.
 */
export type InquiryType = string;

export type InquiryStatus = 'UNANSWERED' | 'ANSWERED' | 'CLOSED' | 'STALE';

export type InquiryAuthorRole = 'SELLER' | 'CS_AGENT';

export interface InquiryTypeOption {
  code: string;
  label: string;              // server-authored display name — never re-derived here (D4)
}

export interface PlatformInquiryTypes {
  platform: string;
  types: InquiryTypeOption[];
}

export interface InquiryReply {
  id: number;
  externalReplyId: string;
  parentExternalReplyId: string | null;
  authorRole: InquiryAuthorRole;
  authorName: string | null;
  content: string;
  transferStatus: string | null;   // raw marketplace transfer state (call-center only)
  repliedAt: string;               // ISO
}

export interface Inquiry {
  id: number;
  platform: string;                // 'COUPANG' — display only. The screen never branches on it (D4).
  /**
   * ⚠️ The server field is `marketplaceAccountId` (it mirrors `OrderItem`); the **query parameter**
   * for the same value is `accountId`. Keep both names as they are instead of renaming one side:
   * a private alias would silently read `undefined` off the response.
   */
  marketplaceAccountId: number;
  accountAlias: string | null;     // '' when unset — always render via `channelOptionLabel()`
  sellerId: number | null;
  sellerName: string | null;
  inquiryType: InquiryType;        // code only — the label lives in the `/types` catalog (D4)
  status: InquiryStatus;
  platformStatus: string;          // raw marketplace status — detail only
  externalInquiryId: string;
  externalOrderId: string | null;
  itemName: string | null;
  content: string;
  category: string | null;
  inquiredAt: string;              // ISO
  answeredAt: string | null;
  linked: boolean;                 // false = not linked to an order line (D15)
  replies?: InquiryReply[];        // filled by the single-inquiry read only
}

/** All four are rendered — `STALE` reaches the 상태 column even though it has no chip. */
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  UNANSWERED: '미답변',
  ANSWERED: '답변완료',
  CLOSED: '종료',
  STALE: '확인필요',
};

/**
 * Chips cover the three statuses the user actually filters by. `STALE` is a local forced close
 * (D9), not an axis anyone browses.
 * ⚠️ Because of that the chip counts can sum to **less** than the 전체 chip. That gap is intended.
 */
export const INQUIRY_STATUS_FILTERS: InquiryStatus[] = ['UNANSWERED', 'ANSWERED', 'CLOSED'];
