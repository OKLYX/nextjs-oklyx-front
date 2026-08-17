import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  ListingMatrixResponse,
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
}
