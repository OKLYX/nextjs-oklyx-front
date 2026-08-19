import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterPoolImage,
} from '@/domain/entities/DetailTemplateEntity';

// Detail templates (CRUD) + master image pool + field mapping (masterId-scoped).
// Listing-scoped detail actions (preview/override/clear) live on
// ListingRegistrationRepository, not here.
export interface DetailContentRepository {
  listTemplates(): Promise<DetailTemplateResponse[]>;
  getTemplate(id: number): Promise<DetailTemplateResponse>;
  createTemplate(data: DetailTemplateRequest): Promise<DetailTemplateResponse>;
  updateTemplate(id: number, data: DetailTemplateRequest): Promise<DetailTemplateResponse>;
  deleteTemplate(id: number): Promise<void>;
  // Image pool (upload lands in the pool first; mapping is a separate step).
  uploadPoolImage(masterId: number, file: File): Promise<MasterPoolImage>;
  listPoolImages(masterId: number): Promise<MasterPoolImage[]>;
  deletePoolImage(masterId: number, imageId: number): Promise<void>;
  // Field mapping (idempotent replace).
  setZoneImages(masterId: number, zoneId: string, imageIds: number[]): Promise<MasterPoolImage[]>;
  setSourceImage(masterId: number, imageId: number | null): Promise<MasterPoolImage | void>;
}
