import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductListParams,
  MasterProductPageResponse,
  MasterProductRequest,
  MasterProductUpdateRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  MasterCategoryRequest,
  MasterCategoryResponse,
  CategoryMetaResponse,
  CategoryMetaSchemaResponse,
  CategoryAttributesRequest,
  ListingMatrixResponse,
  TagsUpdateRequest,
  ShippingOverrideUpdateRequest,
  ShippingForceApplyRequest,
  ShippingForceApplyResponse,
} from '@/domain/entities/MasterProductEntity';
import type { OptionCheckSuffixRequest } from '@/domain/entities/OptionCheckSuffix';

export class MasterProductUseCase {
  constructor(private repository: MasterProductRepository) {}

  list(params: MasterProductListParams): Promise<MasterProductPageResponse> {
    return this.repository.list(params);
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

  getCategory(id: number): Promise<MasterCategoryResponse | null> {
    return this.repository.getCategory(id);
  }

  setCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse> {
    return this.repository.setCategory(id, data);
  }

  clearCategory(id: number): Promise<void> {
    return this.repository.clearCategory(id);
  }

  getCategoryMeta(id: number, platform: string): Promise<CategoryMetaResponse> {
    return this.repository.getCategoryMeta(id, platform);
  }

  getCategorySchema(categoryId: number, platform: string): Promise<CategoryMetaSchemaResponse> {
    return this.repository.getCategorySchema(categoryId, platform);
  }

  setCategoryAttributes(id: number, data: CategoryAttributesRequest): Promise<void> {
    return this.repository.setCategoryAttributes(id, data);
  }

  updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse> {
    return this.repository.updateTags(id, data);
  }

  updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void> {
    return this.repository.updateRegistrationNameSuffix(id, data);
  }

  updateShippingOverride(
    id: number,
    data: ShippingOverrideUpdateRequest,
  ): Promise<MasterProductResponse> {
    return this.repository.updateShippingOverride(id, data);
  }

  applyShippingOverrideToChannels(
    id: number,
    data?: ShippingForceApplyRequest,
  ): Promise<ShippingForceApplyResponse> {
    return this.repository.applyShippingOverrideToChannels(id, data);
  }
}
