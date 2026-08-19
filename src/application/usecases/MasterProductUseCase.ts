import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  MasterCategoryRequest,
  MasterCategoryResponse,
  ListingMatrixResponse,
  TagsUpdateRequest,
} from '@/domain/entities/MasterProductEntity';

export class MasterProductUseCase {
  constructor(private repository: MasterProductRepository) {}

  list(): Promise<MasterProductResponse[]> {
    return this.repository.list();
  }

  getById(id: number): Promise<MasterProductResponse> {
    return this.repository.getById(id);
  }

  create(data: MasterProductRequest): Promise<MasterProductResponse> {
    return this.repository.create(data);
  }

  update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse> {
    return this.repository.update(id, data);
  }

  remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }

  uploadImage(id: number, file: File): Promise<MasterProductResponse> {
    return this.repository.uploadImage(id, file);
  }

  addOption(id: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    return this.repository.addOption(id, data);
  }

  updateOption(id: number, optionId: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    return this.repository.updateOption(id, optionId, data);
  }

  deleteOption(id: number, optionId: number): Promise<void> {
    return this.repository.deleteOption(id, optionId);
  }

  getMatrix(id: number): Promise<ListingMatrixResponse> {
    return this.repository.getMatrix(id);
  }

  upsertCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse> {
    return this.repository.upsertCategory(id, data);
  }

  getCategories(id: number): Promise<MasterCategoryResponse[]> {
    return this.repository.getCategories(id);
  }

  deleteCategory(id: number, platform: string): Promise<void> {
    return this.repository.deleteCategory(id, platform);
  }

  updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse> {
    return this.repository.updateTags(id, data);
  }
}
