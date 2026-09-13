// Repricing (마진 경보 · 판매가 재계산/마켓 반영) domain types — FEATURE_2609_39.
//
// 🔴 실행은 두 단계로 끝까지 나뉜다(PLAN 2609_39 D7):
//   ① recalculate = 로컬 selling_price 만 다시 계산 (마켓 호출 0회)
//   ② push        = 그 값을 마켓에 전송 → 쿠팡은 승인 없이 즉시 실판매가가 된다
// 한 호출로 합치지 말 것.

/** 목록에 담을 행의 범위. 집계(groups)는 이 값과 무관하게 항상 전체를 센다. */
export type RepricingScope = 'BELOW' | 'ALL';

/** 실행(재계산·마켓 반영)에서 빠지는 사유. 값은 서버가 정하고 화면은 라벨만 붙인다. */
export type RepricingExclusion = 'MANUAL' | 'UNCALCULABLE';

/**
 * 🔴 [마켓 반영] 한 요청의 건수 — 서버 상한(200)이 아니라 **화면이 나눠 보내는 단위**다.
 *
 * 200 = 쿠팡 PUT 200회 순차라 게이트웨이 타임아웃(504) 구간이고 실제 소요가 아직 측정되지 않았다
 * (PLAN 2609_39 D26). dev 실측 후 숫자를 올릴 때 **이 상수 하나만** 고친다.
 */
export const REPRICE_PUSH_CHUNK_SIZE = 50;

/** 판매자 × 채널 집계. 실행 단위가 이 축이다(D11). */
export interface RepricingGroup {
  sellerId: number;
  sellerName: string;
  platform: string;
  /** 판정 대상 옵션 수(제외 규칙을 통과해 행으로 내려간 것) */
  optionCount: number;
  /** 대응 필요 + 실행 가능(AUTO 가격) 옵션 수 */
  belowCount: number;
  /** 대응 필요지만 직접 지정가라 실행에서 빠지는 옵션 수(D23 — 편입 셀이 여기 쌓인다) */
  belowManualCount: number;
  /** 아직 안 밀린 옵션 수. marketPrice 가 null 인 행은 「알 수 없음」이라 세지 않는다(D15) */
  pendingPushCount: number;
  /** 이 판매자×채널의 목표 마진율(0~1). 행마다 같은 값이라 그룹에서 한 번만 내려온다 */
  targetMarginRate: number | null;
}

/** 옵션 1건. 금액 필드는 계산 불가(UNCALCULABLE)면 null 로 내려온다. */
export interface RepricingRow {
  listingId: number;
  listingName: string;
  optionId: number;
  optionName: string;
  sellerId: number;
  platform: string;
  /** 마진을 판정한 가격 = marketPrice ?? sellingPrice (D15) */
  judgedPrice: number | null;
  costSum: number | null;
  delivery: number | null;
  box: number | null;
  feeAmount: number | null;
  marginAmount: number | null;
  /** 0~1 소수 */
  marginRate: number | null;
  /** 지금 공식으로 다시 계산한 판매가. 계산 불가면 null */
  newPrice: number | null;
  /**
   * 마진이 0이 되는 판매가. 이 값 아래로 팔면 손해다. 계산 불가면 null (2609_44 / PLAN D1·D3).
   *
   * 🔴 서버가 계산해 내려준다 — 화면이 역산하지 않는다. 화면에는 수수료 **금액**만 있고 비율이 없어
   * 역산하면 반올림이 섞여 값이 어긋난다.
   */
  breakEvenPrice: number | null;
  marketPrice: number | null;
  sellingPrice: number | null;
  /** marketPrice != null && marketPrice != sellingPrice (D25) */
  pendingPush: boolean;
  /** 대응 필요 여부. 직접 지정가 행도 똑같이 판정한다(D23) */
  below: boolean;
  /** 실행에서 빠지는 사유. null = 실행 가능 */
  excluded: RepricingExclusion | null;
  excludedReason: string | null;
}

export interface RepricingCandidatesResponse {
  groups: RepricingGroup[];
  rows: RepricingRow[];
}

export interface RepricingCandidatesParams {
  sellerId?: number;
  platform?: string;
  scope?: RepricingScope;
}

export interface RecalculateFailedCell {
  listingId: number;
  message: string;
}

/** 재계산 결과. 🔴 마켓 호출 0회 — 로컬 판매가만 움직였다는 뜻이다. */
export interface RecalculateResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  cellCount: number;
  /** 판매가가 실제로 달라진 옵션 수 */
  optionChanged: number;
  failed: RecalculateFailedCell[];
}

export interface RepriceSkippedOption {
  optionId: number;
  optionName: string;
  /** 서버가 정한 문장. 화면은 그대로 보여준다 */
  reason: string;
}

export interface RepriceFailedOption {
  optionId: number;
  optionName: string;
  message: string;
}

/** 마켓 반영 결과. 부분 실패가 정상 경로다(200 + failed). */
export interface RepricePushResult {
  pushed: number;
  skipped: RepriceSkippedOption[];
  failed: RepriceFailedOption[];
  /** 429 쿨다운으로 남은 옵션을 중단했는지 */
  stopped: boolean;
  /** stopped 일 때의 재시도 가능 시각(ISO-8601). 쿨다운은 약 10분이라 「잠시 후」로 쓰지 않는다 */
  retryAfter: string | null;
}

/**
 * 🔴 판매가 상한 — 서버 `PriceOverrideRequest.Item.price` 의 `@Digits(integer = 8, fraction = 2)` 와 같은 값이다
 * (`product_listing_option.selling_price` = DECIMAL(10,2)). 컬럼이 못 담는 값을 왕복시키지 않으려고 화면에서 먼저 막는다.
 */
export const PRICE_OVERRIDE_MAX = 99_999_999.99;

/** 판매가 직접 입력 1건(FEATURE_2609_42 / PLAN D3 — 단위는 옵션 1건이다). */
export interface PriceOverrideItem {
  optionId: number;
  price: number;
}

/**
 * 판매가 직접 입력 결과.
 *
 * 🔴 마켓 호출 0회다(D1) — `push` 결과의 `stopped`·`retryAfter` 가 여기 없는 이유이고,
 * 저장만으로는 실판매가가 바뀌지 않는다는 뜻이다.
 * 🔴 저장된 옵션은 `price_source` 가 그대로 AUTO 다(D2) — 다음 재계산이 공식값으로 덮는 것이 정상 동작이다.
 */
export interface PriceOverrideResult {
  applied: number;
  skipped: RepriceSkippedOption[];
  failed: RepriceFailedOption[];
}
