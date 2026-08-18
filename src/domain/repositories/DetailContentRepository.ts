import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterProductImageResponse,
  MasterImageReorderRequest,
} from '@/domain/entities/DetailTemplateEntity';

// Detail templates (CRUD) + master-owned zone images (masterId-scoped).
// Listing-scoped detail actions (preview/override/clear) live on
// ListingRegistrationRepository, not here.
export interface DetailContentRepository {
  listTemplates(): Promise<DetailTemplateResponse[]>;
  getTemplate(id: number): Promise<DetailTemplateResponse>;
  createTemplate(data: DetailTemplateRequest): Promise<DetailTemplateResponse>;
  updateTemplate(id: number, data: DetailTemplateRequest): Promise<DetailTemplateResponse>;
  deleteTemplate(id: number): Promise<void>;
  listImages(masterId: number): Promise<MasterProductImageResponse[]>;
  uploadImage(masterId: number, file: File, zoneId: string): Promise<MasterProductImageResponse>;
  reorderImages(
    masterId: number,
    data: MasterImageReorderRequest,
  ): Promise<MasterProductImageResponse[]>;
  deleteImage(masterId: number, imageId: number): Promise<void>;
}
