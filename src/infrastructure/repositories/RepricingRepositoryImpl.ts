'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { RepricingRepository } from '@/domain/repositories/RepricingRepository';
import type {
  PriceOverrideItem,
  PriceOverrideResult,
  RecalculateResult,
  RepricePushResult,
  RepricingCandidatesParams,
  RepricingCandidatesResponse,
} from '@/domain/entities/RepricingEntity';

const base = '/api/admin/repricing';

export class RepricingRepositoryImpl implements RepricingRepository {
  async candidates(params: RepricingCandidatesParams): Promise<RepricingCandidatesResponse> {
    const response = await axiosInstance.get(`${base}/candidates`, {
      params: {
        sellerId: params.sellerId,
        platform: params.platform || undefined,
        scope: params.scope,
      },
    });
    return response.data.data;
  }

  async recalculate(listingIds: number[]): Promise<RecalculateResult> {
    const response = await axiosInstance.post(`${base}/recalculate`, { listingIds });
    return response.data.data;
  }

  async push(optionIds: number[]): Promise<RepricePushResult> {
    const response = await axiosInstance.post(`${base}/push`, { optionIds });
    return response.data.data;
  }

  async override(items: PriceOverrideItem[]): Promise<PriceOverrideResult> {
    const response = await axiosInstance.post(`${base}/override`, { items });
    return response.data.data;
  }
}
