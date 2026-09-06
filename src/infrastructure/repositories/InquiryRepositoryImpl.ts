'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { InquiryListParams, InquiryRepository } from '@/domain/repositories/InquiryRepository';
import type { Inquiry, PlatformInquiryTypes } from '@/domain/entities/InquiryEntity';

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
}
