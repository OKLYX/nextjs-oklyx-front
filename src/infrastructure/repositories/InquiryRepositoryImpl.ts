'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { InquiryListParams, InquiryRepository } from '@/domain/repositories/InquiryRepository';
import type {
  Inquiry,
  InquirySyncResult,
  PlatformInquiryTypes,
} from '@/domain/entities/InquiryEntity';

export class InquiryRepositoryImpl implements InquiryRepository {
  /**
   * 빈 값은 쿼리에서 **뺀다** — `''` 를 보내면 서버가 빈 문자열 필터로 받아 결과가 0건이 된다.
   * ⚠️ `from`/`to` 는 둘 다 보내거나 둘 다 보내지 않는다(하나만 보내면 400). `period` 가
   * undefined 면 서버 기본 창(최근 14일)이 적용된다.
   */
  async getInquiries(params: InquiryListParams): Promise<Inquiry[]> {
    const query: Record<string, string | number> = {};
    if (params.type) query.type = params.type;
    if (params.status) query.status = params.status;
    if (params.accountId !== undefined) query.accountId = params.accountId;
    if (params.sellerId !== undefined) query.sellerId = params.sellerId;
    if (params.keyword) query.keyword = params.keyword;
    if (params.period) {
      query.from = params.period.from;
      query.to = params.period.to;
    }
    const response = await axiosInstance.get('/api/inquiries', { params: query });
    return response.data.data;
  }

  async getInquiry(id: number): Promise<Inquiry> {
    const response = await axiosInstance.get(`/api/inquiries/${id}`);
    return response.data.data;
  }

  async getTypes(): Promise<PlatformInquiryTypes[]> {
    const response = await axiosInstance.get('/api/inquiries/types');
    return response.data.data;
  }

  /**
   * 문의만 다시 가져오기 — 채널 1개분. 주문 동기화(`/api/orders/sync`)와 같은 자리의 경로이며,
   * 여러 채널을 도는 것은 화면(진행 모달)이 한다.
   */
  async syncInquiries(accountId: number): Promise<InquirySyncResult> {
    const response = await axiosInstance.post('/api/inquiries/sync', null, { params: { accountId } });
    return response.data.data;
  }

  /**
   * 답변 전송 — 조회와 **경로가 다르다**(`/api/admin/…`, ADMIN 전용). 응답은 단건 조회와 같은 모양의
   * 갱신된 문의라 화면이 재조회 없이 스레드·상태·`replyCapability` 를 통째로 교체한다.
   *
   * ⚠️ 에러를 잡지 않는다 — 상태코드(403·502)로 갈라야 하는 판단은 컨테이너가 한다.
   */
  async sendReply(inquiryId: number, content: string): Promise<Inquiry> {
    const response = await axiosInstance.post(`/api/admin/inquiries/${inquiryId}/replies`, {
      content,
    });
    return response.data.data;
  }
}
