import type {
  MasterProductResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  MasterCategoryRequest,
  MasterCategoryResponse,
  CategoryMetaResponse,
  CategoryAttributesRequest,
  ListingMatrixResponse,
  TagsUpdateRequest,
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
  getCategory(id: number): Promise<MasterCategoryResponse | null>;
  setCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse>;
  clearCategory(id: number): Promise<void>;
  getCategoryMeta(id: number, platform: string): Promise<CategoryMetaResponse>;
  setCategoryAttributes(id: number, data: CategoryAttributesRequest): Promise<void>;
  updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse>;
}
