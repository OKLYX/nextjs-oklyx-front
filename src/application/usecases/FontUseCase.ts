import type { FontRepository } from '@/domain/repositories/FontRepository';
import type { FontAsset } from '@/domain/entities/FontEntity';

export class FontUseCase {
  constructor(private repository: FontRepository) {}

  list(): Promise<FontAsset[]> {
    return this.repository.list();
  }

  upload(file: File): Promise<FontAsset> {
    return this.repository.upload(file);
  }
}
