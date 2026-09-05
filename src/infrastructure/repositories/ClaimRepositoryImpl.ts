'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ClaimListParams, ClaimRepository } from '@/domain/repositories/ClaimRepository';
import type {
  Claim,
  ClaimActionPayload,
  ClaimActionResult,
} from '@/domain/entities/ClaimEntity';

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

  // Single re-read after an action (D8) — same envelope, same record shape as the list.
  async getClaim(id: number): Promise<Claim> {
    const response = await axiosInstance.get(`/api/claims/${id}`);
    return response.data.data;
  }

  // ⚠️ Actions live under /api/admin (ADMIN only) while reads live under /api/claims — the paths
  // differ on purpose (D13). A marketplace rejection comes back as 502 with the same result shape
  // in `data`, so callers read `error.response.data.data`, not a 200 body.
  async executeAction(claimId: number, payload: ClaimActionPayload): Promise<ClaimActionResult> {
    const response = await axiosInstance.post(`/api/admin/claims/${claimId}/actions`, payload);
    return response.data.data;
  }
}
