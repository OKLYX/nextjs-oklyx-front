'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { DetailImageGroupRepository } from '@/domain/repositories/DetailImageGroupRepository';
import type { DetailImageGroup } from '@/domain/entities/DetailImageGroupEntity';

const base = '/api/admin/detail-image-groups';

export class DetailImageGroupRepositoryImpl implements DetailImageGroupRepository {
  async list(): Promise<DetailImageGroup[]> {
    const response = await axiosInstance.get(base);
    return response.data.data;
  }

  async create(name: string): Promise<DetailImageGroup> {
    const response = await axiosInstance.post(base, { name });
    return response.data.data;
  }

  async rename(id: number, name: string): Promise<DetailImageGroup> {
    const response = await axiosInstance.put(`${base}/${id}`, { name });
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }
}
