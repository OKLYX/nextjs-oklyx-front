import type { ThumbnailTemplate, FontAsset, TemplateAsset } from '@/domain/entities/ThumbnailEntity';
import type { ThumbnailTemplateRequest, ThumbnailPreviewRequest } from '@/application/dto/ThumbnailDTOs';

export interface ThumbnailTemplateRepository {
  list(): Promise<ThumbnailTemplate[]>;
  getById(id: number): Promise<ThumbnailTemplate>;
  create(req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate>;
  update(id: number, req: ThumbnailTemplateRequest): Promise<ThumbnailTemplate>;
  remove(id: number): Promise<void>;
  // Returns image/jpeg blob (responseType: 'blob'), not the JSON envelope.
  preview(req: ThumbnailPreviewRequest): Promise<Blob>;
  listFonts(): Promise<FontAsset[]>;
  uploadFont(file: File): Promise<FontAsset>;
  // Tenant-shared fixed image assets (mirror of the font endpoints).
  listAssets(): Promise<TemplateAsset[]>;
  uploadAsset(file: File): Promise<TemplateAsset>;
  renameAsset(id: number, name: string): Promise<TemplateAsset>;
  deleteAsset(id: number): Promise<void>;
}
