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

export interface MasterProductRepository {
  list(params: MasterProductListParams): Promise<MasterProductPageResponse>;
  getById(id: number): Promise<MasterProductResponse>;
  // 같은 구성상품 조합을 쓰는 마스터 (2609_46). 정확히 같은 집합만 — 부분집합·상위집합은 다른 마스터.
  findByComponents(productIds: number[]): Promise<MasterProductByComponents[]>;
  create(data: MasterProductRequest): Promise<MasterProductResponse>;
  update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse>;
  // 2609_64: 구성상품 집합 + 옵션 전체를 한 트랜잭션에서 교체한다. 요청에 없는 기존 옵션은 삭제된다.
  // 일상적인 옵션 하나 수정은 여전히 addOption/updateOption/deleteOption 을 쓴다.
  updateComposition(id: number, data: MasterCompositionRequest): Promise<MasterProductResponse>;
  remove(id: number): Promise<void>;
  uploadImage(id: number, file: File): Promise<MasterProductResponse>;
  addOption(id: number, data: MasterOptionRequest): Promise<MasterOptionResponse>;
  updateOption(id: number, optionId: number, data: MasterOptionRequest): Promise<MasterOptionResponse>;
  deleteOption(id: number, optionId: number): Promise<void>;
  getMatrix(id: number): Promise<ListingMatrixResponse>;
  // 2609_61/D6: 마스터의 모든 채널 셀 + 옵션을 한 번에. 셀마다 옵션을 조회하지 말 것.
  getChannelOptions(id: number): Promise<MasterChannelOptionsResponse>;
  getCategory(id: number): Promise<MasterCategoryResponse | null>;
  setCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse>;
  clearCategory(id: number): Promise<void>;
  getCategoryMeta(id: number, platform: string): Promise<CategoryMetaResponse>;
  // Schema only, keyed by (platform × categoryId) — used before a master exists.
  getCategorySchema(categoryId: number, platform: string): Promise<CategoryMetaSchemaResponse>;
  setCategoryAttributes(id: number, data: CategoryAttributesRequest): Promise<void>;
  updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse>;
  updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void>;
  updateShippingOverride(id: number, data: ShippingOverrideUpdateRequest): Promise<MasterProductResponse>;
  applyShippingOverrideToChannels(
    id: number,
    data?: ShippingForceApplyRequest,
  ): Promise<ShippingForceApplyResponse>;
}
