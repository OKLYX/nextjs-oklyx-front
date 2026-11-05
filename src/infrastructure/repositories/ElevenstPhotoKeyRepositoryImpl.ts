import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { ElevenstPhotoKeyRepository } from '@/domain/repositories/ElevenstPhotoKeyRepository';
import type { ElevenstPhotoKey, ElevenstPhotoKeyUpdateRequest } from '@/domain/entities/ElevenstPhotoKeyEntity';

export class ElevenstPhotoKeyRepositoryImpl implements ElevenstPhotoKeyRepository {
  async get(): Promise<ElevenstPhotoKey> {
    const response = await axiosInstance.get('/api/admin/elevenst-photo-key');
    return response.data.data;
  }

  async update(request: ElevenstPhotoKeyUpdateRequest): Promise<ElevenstPhotoKey> {
    const response = await axiosInstance.put('/api/admin/elevenst-photo-key', request);
    return response.data.data;
  }
}
