import type { ElevenstPhotoKey, ElevenstPhotoKeyUpdateRequest } from '@/domain/entities/ElevenstPhotoKeyEntity';

// GET and PUT are ADMIN only (FEATURE_2611_11 / D39).
export interface ElevenstPhotoKeyRepository {
  get(): Promise<ElevenstPhotoKey>;
  update(request: ElevenstPhotoKeyUpdateRequest): Promise<ElevenstPhotoKey>;
}
