import type {
  Inquiry,
  InquiryStatus,
  PlatformInquiryTypes,
} from '@/domain/entities/InquiryEntity';
import type { OrderPeriodRange } from '@/domain/entities/OrderPeriod';

export interface InquiryListParams {
  type?: string;
  status?: InquiryStatus;
  accountId?: number;
  sellerId?: number;
  keyword?: string;
  period?: OrderPeriodRange;     // undefined = server default window (recent 14 days)
}

/**
 * 고객문의 조회 (FEATURE_2609_23 / Stage A).
 *
 * ⚠️ 채널(계정) 목록을 여기에 만들지 않는다 — 채널 옵션의 유일한 원천은
 * `OrderUseCase.getSyncTargets()` 다. 두 벌이 되면 같은 계정이 화면마다 다른 라벨로 보인다.
 */
export interface InquiryRepository {
  getInquiries(params: InquiryListParams): Promise<Inquiry[]>;
  /** 단건 — 답변 스레드까지 채워져 온다. 상세 페이지(03)가 쓴다. */
  getInquiry(id: number): Promise<Inquiry>;
  /** 플랫폼별 지원 유형 (D4) — 유형 탭의 유일한 원천. */
  getTypes(): Promise<PlatformInquiryTypes[]>;
}
