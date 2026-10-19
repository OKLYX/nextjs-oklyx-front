import type {
  CollageOverview,
  CollagePreviewRequest,
  CollageSaveRequest,
  CollageStageKey,
  CollageStageResponse,
} from '@/domain/entities/CollageEntity';

// Thumbnail collage stages of a master (FEATURE_2610_21) — ADMIN-only.
export interface CollageRepository {
  overview(masterId: number): Promise<CollageOverview>;
  getStage(masterId: number, key: CollageStageKey): Promise<CollageStageResponse>;
  save(masterId: number, key: CollageStageKey, data: CollageSaveRequest): Promise<CollageStageResponse>;
  remove(masterId: number, key: CollageStageKey): Promise<CollageStageResponse>;
  preview(masterId: number, data: CollagePreviewRequest): Promise<Blob>;
}
