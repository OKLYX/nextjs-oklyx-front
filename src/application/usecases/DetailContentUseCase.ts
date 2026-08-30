import type { DetailContentRepository } from '@/domain/repositories/DetailContentRepository';
import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterPoolImage,
} from '@/domain/entities/DetailTemplateEntity';

export class DetailContentUseCase {
  constructor(private repository: DetailContentRepository) {}

  listTemplates(): Promise<DetailTemplateResponse[]> {
    return this.repository.listTemplates();
  }

  getTemplate(id: number): Promise<DetailTemplateResponse> {
    return this.repository.getTemplate(id);
  }

  createTemplate(data: DetailTemplateRequest): Promise<DetailTemplateResponse> {
    return this.repository.createTemplate(data);
  }

  updateTemplate(id: number, data: DetailTemplateRequest): Promise<DetailTemplateResponse> {
    return this.repository.updateTemplate(id, data);
  }

  deleteTemplate(id: number): Promise<void> {
    return this.repository.deleteTemplate(id);
  }

  uploadPoolImage(masterId: number, file: File): Promise<MasterPoolImage> {
    return this.repository.uploadPoolImage(masterId, file);
  }

  listPoolImages(masterId: number): Promise<MasterPoolImage[]> {
    return this.repository.listPoolImages(masterId);
  }

  deletePoolImage(masterId: number, imageId: number): Promise<void> {
    return this.repository.deletePoolImage(masterId, imageId);
  }

  setZoneImages(masterId: number, zoneId: string, imageIds: number[]): Promise<MasterPoolImage[]> {
    return this.repository.setZoneImages(masterId, zoneId, imageIds);
  }

  setSourceImage(masterId: number, imageId: number | null): Promise<MasterPoolImage | void> {
    return this.repository.setSourceImage(masterId, imageId);
  }

  importProductImages(masterId: number, productImageIds: number[]): Promise<MasterPoolImage[]> {
    return this.repository.importProductImages(masterId, productImageIds);
  }
}
