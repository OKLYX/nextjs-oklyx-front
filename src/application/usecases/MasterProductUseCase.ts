import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductListParams,
  MasterProductPageResponse,
  MasterProductRequest,
  MasterProductByComponents,
  MasterProductUpdateRequest,
  MasterCompositionRequest,
  MasterOptionRequest,
  MasterOptionResponse,
  MasterCategoryRequest,
  MasterCategoryResponse,
  CategoryMetaResponse,
  CategoryMetaSchemaResponse,
  CategoryAttributesRequest,
  ListingMatrixResponse,
  MasterChannelOptionsResponse,
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

  /** 같은 구성상품 조합의 마스터 (2609_46). 없으면 빈 배열 = 새로 만들어도 되는 조합. */
  findByComponents(productIds: number[]): Promise<MasterProductByComponents[]> {
    return this.repository.findByComponents(productIds);
  }

  create(data: MasterProductRequest): Promise<MasterProductResponse> {
    return this.repository.create(data);
  }

  update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse> {
    return this.repository.update(id, data);
  }

  /** 구성상품 + 옵션 전체를 한 번에 교체 (2609_64). 요청에 없는 기존 옵션은 삭제된다. */
  updateComposition(id: number, data: MasterCompositionRequest): Promise<MasterProductResponse> {
    return this.repository.updateComposition(id, data);
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

  /** 모든 채널 셀의 옵션(옵션 ID 포함)을 한 번에 (2609_61). 셀이 없으면 `cells` 가 빈 배열이다. */
  getChannelOptions(id: number): Promise<MasterChannelOptionsResponse> {
    return this.repository.getChannelOptions(id);
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
