'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PriceHistoryRepository } from '@/domain/repositories/PriceHistoryRepository';
import type { PriceChangeRow, PriceHistoryParams } from '@/domain/entities/PriceHistoryEntity';

const base = '/api/admin/price-history';

export class PriceHistoryRepositoryImpl implements PriceHistoryRepository {
  /** 빈 값은 보내지 않는다 — 서버는 파라미터가 하나도 없으면 「최근 100건」을 내려준다. */
  async search(params: PriceHistoryParams): Promise<PriceChangeRow[]> {
    const response = await axiosInstance.get(base, {
      params: {
        productId: params.productId,
        optionId: params.optionId,
        listingId: params.listingId,
        masterProductId: params.masterProductId,
        sellerId: params.sellerId,
        platform: params.platform || undefined,
        targetType: params.targetType,
        from: params.from || undefined,
        to: params.to || undefined,
      },
    });
    return response.data.data;
  }
}
