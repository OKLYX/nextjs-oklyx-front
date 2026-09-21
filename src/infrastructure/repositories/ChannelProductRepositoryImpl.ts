'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ChannelProductRepository } from '@/domain/repositories/ChannelProductRepository';
import type {
  ChannelProductDetail,
  ChannelProductSearch,
} from '@/domain/entities/ChannelProductEntity';

const base = '/api/admin/channel-products';

export class ChannelProductRepositoryImpl implements ChannelProductRepository {
  async search(
    sellerId: number,
    platform: string,
    name: string,
    nextToken?: string,
  ): Promise<ChannelProductSearch> {
    const response = await axiosInstance.get(base, {
      params: { sellerId, platform, name, nextToken },
    });
    return response.data.data;
  }

  async detail(
    sellerId: number,
    platform: string,
    platformProductId: string,
  ): Promise<ChannelProductDetail> {
    const response = await axiosInstance.get(`${base}/${platformProductId}`, {
      params: { sellerId, platform },
    });
    return response.data.data;
  }
}
