// 가격 변경 이력 domain types — 서버 `GET /api/admin/price-history` (FEATURE_2609_28 / PLAN D23).
//
// 🔴 이 로그에는 **판매가 말고 다른 것도 섞여 있다**(매입 원가·수수료율). 판매가만 보려면
//    `targetType=LISTING_SELLING` 을 반드시 보낸다 — 서버는 필터를 주지 않으면 전부 섞어 내려준다.
// 🔴 읽기 전용이다. 이력을 더하거나 고치는 엔드포인트는 없다(고칠 수 있는 기록은 아무것도 증명하지 못한다).

/** 어떤 가격이 움직였는지. 판매가 화면은 `LISTING_SELLING` 만 쓴다. */
export type PriceTargetType = 'PRODUCT_COST' | 'LISTING_SELLING' | 'PLATFORM_COMMISSION';

/** 왜 움직였는지. 서버 enum 이고 화면은 라벨만 붙인다. */
export type PriceChangeReason =
  | 'PURCHASE_UPDATE'
  | 'PRODUCT_EDIT'
  | 'PROPAGATION'
  | 'MANUAL'
  | 'SETTLEMENT_FEEDBACK';

/** 🔴 enum 을 화면에 그대로 노출하지 않는다. 서버가 값을 더하면 여기에 한 줄 더한다. */
const REASON_LABEL: Record<PriceChangeReason, string> = {
  PROPAGATION: '원가 변동 반영',
  MANUAL: '직접 입력',
  PRODUCT_EDIT: '상품 수정',
  PURCHASE_UPDATE: '매입가 변동',
  SETTLEMENT_FEEDBACK: '정산 수수료 반영',
};

/** 모르는 값이 오면 원문을 보여준다 — 빈칸보다 낫다(서버가 enum 을 늘렸다는 신호가 된다). */
export const priceChangeReasonLabel = (reason: PriceChangeReason | null): string =>
  reason == null ? '—' : (REASON_LABEL[reason] ?? reason);

/**
 * 이력 1건.
 *
 * ⚠️ 채널 블록(`listingId`·`listingName`·`platform`·`masterProductId`)은 `LISTING_SELLING` 행에만 채워진다.
 * `PRODUCT_COST` 행은 전부 null 이다 — 원가 변경은 채널에 속하지 않는다.
 */
export interface PriceChangeRow {
  id: number;
  targetType: PriceTargetType;
  productId: number | null;
  productName: string | null;
  listingId: number | null;
  listingName: string | null;
  platform: string | null;
  masterProductId: number | null;
  optionId: number | null;
  optionName: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  /** 서버가 계산해 내려준다(`newPrice - oldPrice`). 한쪽이 null 이면 null */
  diff: number | null;
  reason: PriceChangeReason | null;
  purchaseRecordId: number | null;
  createdBy: string | null;
  /** `2026-09-13T14:05:33` — 서버 로컬 시각 문자열(타임존 표기 없음) */
  createdAt: string;
}

export interface PriceHistoryParams {
  productId?: number;
  optionId?: number;
  listingId?: number;
  masterProductId?: number;
  sellerId?: number;
  platform?: string;
  targetType?: PriceTargetType;
  /** `yyyy-MM-dd`. 서버는 `to` 를 그날 끝까지로 해석한다 */
  from?: string;
  to?: string;
}

/** `2026-09-13T14:05:33` → `2026-09-13 14:05`. 초는 버린다 — 사람이 읽을 값이다. */
export const formatChangedAt = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
