import type { CollageRepository } from '@/domain/repositories/CollageRepository';
import type {
  CollageOverview,
  CollagePreviewRequest,
  CollageSaveRequest,
  CollageStageKey,
  CollageStageResponse,
} from '@/domain/entities/CollageEntity';

export class CollageUseCase {
  constructor(private repository: CollageRepository) {}

  overview(masterId: number): Promise<CollageOverview> {
    return this.repository.overview(masterId);
  }

  getStage(masterId: number, key: CollageStageKey): Promise<CollageStageResponse> {
    return this.repository.getStage(masterId, key);
  }

  save(masterId: number, key: CollageStageKey, data: CollageSaveRequest): Promise<CollageStageResponse> {
    return this.repository.save(masterId, key, data);
  }

  remove(masterId: number, key: CollageStageKey): Promise<CollageStageResponse> {
    return this.repository.remove(masterId, key);
  }

  preview(masterId: number, data: CollagePreviewRequest): Promise<Blob> {
    return this.repository.preview(masterId, data);
  }
}
