import type {
  ProcessingPreset,
  ProcessingPresetRequest,
} from '@/domain/entities/ProcessingPresetEntity';

// Image-processing preset library (CRUD) — tenant-shared, ADMIN-only.
export interface ProcessingPresetRepository {
  list(): Promise<ProcessingPreset[]>;
  get(id: number): Promise<ProcessingPreset>;
  create(data: ProcessingPresetRequest): Promise<ProcessingPreset>;
  update(id: number, data: ProcessingPresetRequest): Promise<ProcessingPreset>;
  remove(id: number): Promise<void>;
}
