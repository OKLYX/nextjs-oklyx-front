'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ClaimListParams, ClaimRepository } from '@/domain/repositories/ClaimRepository';
import type { Claim } from '@/domain/entities/ClaimEntity';

export class ClaimRepositoryImpl implements ClaimRepository {
  // period omitted -> no from/to sent, so the server applies its default window.
  async getClaims(p: ClaimListParams): Promise<Claim[]> {
    const params = {
      type: p.type,
      ...(p.sellerId != null ? { sellerId: p.sellerId } : {}),
      ...(p.keyword ? { keyword: p.keyword } : {}),
      ...(p.period ?? {}),
    };
    const response = await axiosInstance.get('/api/claims', { params });
    return response.data.data;
  }
}
