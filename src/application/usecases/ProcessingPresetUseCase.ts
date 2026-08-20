import type { ProcessingPresetRepository } from '@/domain/repositories/ProcessingPresetRepository';
import type {
  ProcessingPreset,
  ProcessingPresetRequest,
} from '@/domain/entities/ProcessingPresetEntity';

export class ProcessingPresetUseCase {
  constructor(private repository: ProcessingPresetRepository) {}

  list(): Promise<ProcessingPreset[]> {
    return this.repository.list();
  }

  get(id: number): Promise<ProcessingPreset> {
    return this.repository.get(id);
  }

  create(data: ProcessingPresetRequest): Promise<ProcessingPreset> {
    return this.repository.create(data);
  }

  update(id: number, data: ProcessingPresetRequest): Promise<ProcessingPreset> {
    return this.repository.update(id, data);
  }

  remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }
}
