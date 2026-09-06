import type { InquiryListParams, InquiryRepository } from '@/domain/repositories/InquiryRepository';
import type {
  Inquiry,
  InquiryTypeOption,
  PlatformInquiryTypes,
} from '@/domain/entities/InquiryEntity';

/**
 * 고객문의 usecase (FEATURE_2609_23). 리포지토리 위임이 전부다 — 상태 판정·답변 가능 여부 같은
 * 비즈니스 판단은 서버가 내려주고(D4·D5) 화면은 렌더만 한다.
 */
export class InquiryUseCase {
  constructor(private repository: InquiryRepository) {}

  async getInquiries(params: InquiryListParams): Promise<Inquiry[]> {
    return this.repository.getInquiries(params);
  }

  async getInquiry(id: number): Promise<Inquiry> {
    return this.repository.getInquiry(id);
  }

  async getTypes(): Promise<PlatformInquiryTypes[]> {
    return this.repository.getTypes();
  }

  /** 답변 전송 (D17). 성공하면 갱신된 문의로 화면을 통째 교체한다 — 로컬에서 스레드를 조립하지 않는다. */
  async sendReply(inquiryId: number, content: string): Promise<Inquiry> {
    return this.repository.sendReply(inquiryId, content);
  }

  /**
   * 플랫폼별 유형 목록을 탭 하나에 쓸 평탄한 목록으로 만든다.
   *
   * 서버가 준 플랫폼 순서대로 이어 붙이고, 같은 `code` 가 겹치면 **첫 항목만** 남긴다(라벨도 첫 것).
   * 화면이 `platform` 으로 분기하지 않기 위한 규칙이다(D4) — 플랫폼이 늘어도 탭 코드는 그대로다.
   */
  flattenTypes(catalog: PlatformInquiryTypes[]): InquiryTypeOption[] {
    const byCode = new Map<string, InquiryTypeOption>();
    catalog.forEach((platform) => {
      platform.types.forEach((type) => {
        if (!byCode.has(type.code)) byCode.set(type.code, type);
      });
    });
    return [...byCode.values()];
  }
}
