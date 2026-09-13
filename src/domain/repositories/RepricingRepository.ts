import type {
  RecalculateResult,
  RepricePushResult,
  RepricingCandidatesParams,
  RepricingCandidatesResponse,
} from '@/domain/entities/RepricingEntity';

export interface RepricingRepository {
  /** 대응 필요 목록 + 판매자 × 채널 집계. 아무것도 저장하지 않는다. */
  candidates(params: RepricingCandidatesParams): Promise<RepricingCandidatesResponse>;

  /** ① 재계산 — 셀(listing) 단위. 마켓 호출 0회. */
  recalculate(listingIds: number[]): Promise<RecalculateResult>;

  /** ② 마켓 반영 — 옵션 단위. 🔴 실제 판매 가격이 바뀐다. */
  push(optionIds: number[]): Promise<RepricePushResult>;
}
