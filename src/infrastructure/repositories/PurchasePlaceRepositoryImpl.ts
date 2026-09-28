'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PurchasePlaceRepository } from '@/domain/repositories/PurchasePlaceRepository';
import type { PurchasePlace } from '@/domain/entities/PurchasePlace';

// 🔴 GET 은 모든 로그인 사용자, POST·PUT·DELETE 는 관리자만(백엔드 SecurityConfig, D14).
const base = '/api/admin/purchase-places';

export class PurchasePlaceRepositoryImpl implements PurchasePlaceRepository {
  async list(): Promise<PurchasePlace[]> {
    const response = await axiosInstance.get(base);
    return response.data.data;
  }

  async create(name: string): Promise<PurchasePlace> {
    const response = await axiosInstance.post(base, { name });
    return response.data.data;
  }

  async rename(id: number, name: string): Promise<PurchasePlace> {
    const response = await axiosInstance.put(`${base}/${id}`, { name });
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }
}
