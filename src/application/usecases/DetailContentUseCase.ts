import type { DetailContentRepository } from '@/domain/repositories/DetailContentRepository';
import type {
  DetailTemplateResponse,
  DetailTemplateRequest,
  MasterProductImageResponse,
  MasterImageReorderRequest,
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

  listImages(masterId: number): Promise<MasterProductImageResponse[]> {
    return this.repository.listImages(masterId);
  }

  uploadImage(masterId: number, file: File, zoneId: string): Promise<MasterProductImageResponse> {
    return this.repository.uploadImage(masterId, file, zoneId);
  }

  reorderImages(
    masterId: number,
    data: MasterImageReorderRequest,
  ): Promise<MasterProductImageResponse[]> {
    return this.repository.reorderImages(masterId, data);
  }

  deleteImage(masterId: number, imageId: number): Promise<void> {
    return this.repository.deleteImage(masterId, imageId);
  }
}
