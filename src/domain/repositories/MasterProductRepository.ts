import type {
  MasterProductResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  ListingMatrixResponse,
} from '@/domain/entities/MasterProductEntity';

export interface MasterProductRepository {
  list(): Promise<MasterProductResponse[]>;
  getById(id: number): Promise<MasterProductResponse>;
  create(data: MasterProductRequest): Promise<MasterProductResponse>;
  update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse>;
  remove(id: number): Promise<void>;
  uploadImage(id: number, file: File): Promise<MasterProductResponse>;
  addOption(id: number, data: MasterOptionRequest): Promise<MasterOptionResponse>;
  updateOption(id: number, optionId: number, data: MasterOptionRequest): Promise<MasterOptionResponse>;
  deleteOption(id: number, optionId: number): Promise<void>;
  getMatrix(id: number): Promise<ListingMatrixResponse>;
}
