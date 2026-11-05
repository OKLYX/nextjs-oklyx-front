import type { ElevenstPhotoKeyRepository } from '@/domain/repositories/ElevenstPhotoKeyRepository';
import type { ElevenstPhotoKey, ElevenstPhotoKeyUpdateRequest } from '@/domain/entities/ElevenstPhotoKeyEntity';

export class ElevenstPhotoKeyUseCase {
  constructor(private repository: ElevenstPhotoKeyRepository) {}

  async get(): Promise<ElevenstPhotoKey> {
    return this.repository.get();
  }

  async update(request: ElevenstPhotoKeyUpdateRequest): Promise<ElevenstPhotoKey> {
    return this.repository.update(request);
  }
}
