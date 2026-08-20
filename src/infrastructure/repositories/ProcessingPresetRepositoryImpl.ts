'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ProcessingPresetRepository } from '@/domain/repositories/ProcessingPresetRepository';
import type {
  ProcessingPreset,
  ProcessingPresetRequest,
} from '@/domain/entities/ProcessingPresetEntity';

const base = '/api/admin/processing-presets';

export class ProcessingPresetRepositoryImpl implements ProcessingPresetRepository {
  async list(): Promise<ProcessingPreset[]> {
    const response = await axiosInstance.get(base);
    return response.data.data;
  }

  async get(id: number): Promise<ProcessingPreset> {
    const response = await axiosInstance.get(`${base}/${id}`);
    return response.data.data;
  }

  async create(data: ProcessingPresetRequest): Promise<ProcessingPreset> {
    const response = await axiosInstance.post(base, data);
    return response.data.data;
  }

  async update(id: number, data: ProcessingPresetRequest): Promise<ProcessingPreset> {
    const response = await axiosInstance.patch(`${base}/${id}`, data);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }
}
