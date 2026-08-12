import type { ThumbnailTemplateRepository } from '@/domain/repositories/ThumbnailTemplateRepository';
import type { ThumbnailTemplate, FontAsset } from '@/domain/entities/ThumbnailEntity';
import type { ThumbnailTemplateRequest, ThumbnailPreviewRequest } from '@/application/dto/ThumbnailDTOs';

export class ThumbnailTemplateUseCase {
  constructor(private repository: ThumbnailTemplateRepository) {}

  async list(): Promise<ThumbnailTemplate[]> {
    return this.repository.list();
  }

  async getById(id: number): Promise<ThumbnailTemplate> {
    return this.repository.getById(id);
  }

  async create(req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate> {
    return this.repository.create(req);
  }

  async update(id: number, req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate> {
    return this.repository.update(id, req);
  }

  async remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }

  async preview(req: ThumbnailPreviewRequest): Promise<Blob> {
    return this.repository.preview(req);
  }

  async listFonts(): Promise<FontAsset[]> {
    return this.repository.listFonts();
  }

  async uploadFont(file: File): Promise<FontAsset> {
    return this.repository.uploadFont(file);
  }
}
