import type {
  Inquiry,
  InquiryStatus,
  InquirySyncResult,
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
  /**
   * 답변 전송 (ADMIN 전용, D17 — 되돌릴 수 없다). 갱신된 문의 1건을 돌려받는다.
   * ⚠️ `parentReplyId` 를 보내지 않는다 — 서버가 전송 시점에 자기 값을 다시 고른다.
   */
  sendReply(inquiryId: number, content: string): Promise<Inquiry>;
  /**
   * 채널 1개의 문의를 마켓에서 다시 가져온다. 문의만 보려고 주문 동기화 전체를 돌리지 않기 위한 입구다.
   * ⚠️ 채널을 하나씩 부른다 — 여러 채널을 한 번에 도는 경로를 만들지 않는다(진행 상황을 그려야 한다).
   */
  syncInquiries(accountId: number): Promise<InquirySyncResult>;
}
