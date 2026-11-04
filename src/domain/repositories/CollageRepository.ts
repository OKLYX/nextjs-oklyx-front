import type {
  CollageCoverRequest,
  CollageOverview,
  CollagePreviewRequest,
  CollageSaveRequest,
  CollageStageKey,
  CollageStageResponse,
} from '@/domain/entities/CollageEntity';
import type { MasterPoolImage } from '@/domain/entities/DetailTemplateEntity';

// Thumbnail collage stages of a master (FEATURE_2610_21) and the cover-photo save (FEATURE_2611_10) — ADMIN-only.
export interface CollageRepository {
  overview(masterId: number): Promise<CollageOverview>;
  getStage(masterId: number, key: CollageStageKey): Promise<CollageStageResponse>;
  save(masterId: number, key: CollageStageKey, data: CollageSaveRequest): Promise<CollageStageResponse>;
  remove(masterId: number, key: CollageStageKey): Promise<CollageStageResponse>;
  preview(masterId: number, data: CollagePreviewRequest): Promise<Blob>;
  /** FEATURE_2611_10 D15 · D31: the new pool image, now the master cover photo. No regeneration (D32). */
  saveAsCover(masterId: number, data: CollageCoverRequest): Promise<MasterPoolImage>;
}
