'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { MarginPolicyRepository } from '@/domain/repositories/MarginPolicyRepository';
import type {
  MarginPolicyResponse,
  MarginPolicyRequest,
} from '@/domain/entities/MarginPolicyEntity';

const base = '/api/admin/margin-policies';

export class MarginPolicyRepositoryImpl implements MarginPolicyRepository {
  async list(): Promise<MarginPolicyResponse[]> {
    const response = await axiosInstance.get(base);
    return response.data.data;
  }

  async getById(id: number): Promise<MarginPolicyResponse> {
    const response = await axiosInstance.get(`${base}/${id}`);
    return response.data.data;
  }

  async create(data: MarginPolicyRequest): Promise<MarginPolicyResponse> {
    const response = await axiosInstance.post(base, data);
    return response.data.data;
  }

  async update(id: number, data: MarginPolicyRequest): Promise<MarginPolicyResponse> {
    const response = await axiosInstance.patch(`${base}/${id}`, data);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }
}
