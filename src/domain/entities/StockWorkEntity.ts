import type { ClaimType } from '@/domain/entities/ClaimEntity';

/**
 * Stock work screens — 「입고 작업」 「반품 재입고」 · 「출고 작업」 「교환 발송」 (FEATURE_2611_34 D16 ~ D33 · D38 · D42).
 *
 * The two tabs share one panel (`ClaimWorkPanel`); `ClaimWorkKind` picks the endpoints and `CLAIM_WORK_TEXT` the words.
 */
export type ClaimWorkKind = 'RETURN_IN' | 'EXCHANGE_SHIP';

/** One product of a claim, expanded from the order option (D20 · R6). */
export interface ClaimWorkItem {
  productId: number;
  productName: string;
  imageUrl: string | null;
  barcode: string | null;
  requiredQty: number;
  doneQty: number;
  remainingQty: number;
}

/** One return or exchange claim as the lookups return it (PLAN §3-4). `items` is filled only when `failure` is null (R7). */
export interface ClaimWork {
  orderClaimId: number;
  claimType: ClaimType;
  externalOrderId: string;
  platform: string;
  accountAlias: string | null;
  sellerName: string | null;
  requesterName: string | null;
  claimStatus: string;
  collectStatus: string | null;
  itemName: string | null;
  claimQty: number;
  receivedAt: string;
  failure: string | null;
  items: ClaimWorkItem[];
}

/** One line of the recently shipped orders list (PLAN §3-5 · D29 · D39). */
export interface ShippedOrder {
  orderId: number;
  externalOrderId: string;
  orderedAt: string | null;
  platform: string;
  accountAlias: string | null;
  sellerName: string | null;
  itemName: string | null;
  claimPending: boolean;
}

/** Key of the entered quantity of one (claim · product) cell. */
export const claimItemKey = (orderClaimId: number, productId: number): string => `${orderClaimId}:${productId}`;

export interface ClaimWorkText {
  allDone: string;
  /** The scanned barcode is appended after the colon and space (D32). */
  notInClaim: string;
  unknownItems: string;
  requiredHeader: string;
  doneHeader: string;
  enteredHeader: string;
  dateLabel: string;
  saveLabel: string;
  saved: string;
  saveFail: string;
  lookupFail: string;
}

/** The words of each tab — the only place they live (D21 · D31 · D32 · D42 · R14 · R27). */
export const CLAIM_WORK_TEXT: Record<ClaimWorkKind, ClaimWorkText> = {
  RETURN_IN: {
    allDone: '이 반품은 모두 재입고했습니다',
    notInClaim: '이 반품에 없는 물건입니다: ',
    unknownItems: '이 반품은 받을 물건을 알 수 없습니다 — 입고·조정 화면의 반품 대기에서 기록하세요',
    requiredHeader: '받을 수량',
    doneHeader: '이미 재입고',
    enteredHeader: '이번 들어온 수량',
    dateLabel: '재입고일',
    saveLabel: '반품 재입고 저장',
    saved: '반품 재입고를 저장했습니다.',
    saveFail: '반품 재입고를 저장하지 못했습니다.',
    lookupFail: '송장을 찾지 못했습니다.',
  },
  EXCHANGE_SHIP: {
    allDone: '이 교환은 모두 발송했습니다',
    notInClaim: '이 교환에 없는 물건입니다: ',
    unknownItems: '이 교환은 보낼 물건을 알 수 없습니다 — 판매상품의 옵션 연결을 고친 뒤 다시 여세요',
    requiredHeader: '보낼 수량',
    doneHeader: '이미 발송',
    enteredHeader: '이번 보낸 수량',
    dateLabel: '발송일',
    saveLabel: '교환 발송 저장',
    saved: '교환 발송을 저장했습니다.',
    saveFail: '교환 발송을 저장하지 못했습니다.',
    lookupFail: '송장을 찾지 못했습니다.',
  },
};
