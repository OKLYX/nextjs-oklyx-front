'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { MasterProductRepository } from '@/domain/repositories/MasterProductRepository';
import type {
  MasterProductResponse,
  MasterProductListParams,
  MasterProductPageResponse,
  MasterProductRequest,
  MasterProductByComponents,
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

const base = '/api/admin/master-products';
const lookupBase = '/api/admin/category-lookup';

export class MasterProductRepositoryImpl implements MasterProductRepository {
  // Paged list (110). `search` undefined => axios drops the key entirely.
  async list(params: MasterProductListParams): Promise<MasterProductPageResponse> {
    const response = await axiosInstance.get(base, {
      params: {
        page: params.page,
        size: params.size,
        sort: params.sort,
        search: params.search,
      },
    });
    return response.data.data;
  }

  async getById(id: number): Promise<MasterProductResponse> {
    const response = await axiosInstance.get(`${base}/${id}`);
    return response.data.data;
  }

  // 2609_46: 정확히 같은 구성상품 집합을 쓰는 마스터. 순서 무관(서버가 집합으로 비교),
  // 비어 있으면 서버를 부르지 않는다(백엔드는 productIds 를 필수 파라미터로 받는다).
  async findByComponents(productIds: number[]): Promise<MasterProductByComponents[]> {
    if (productIds.length === 0) return [];
    const response = await axiosInstance.get(`${base}/by-components`, {
      // 백엔드가 `List<Long>` 으로 받으므로 콤마 한 줄로 보낸다(axios 기본 배열 직렬화 회피).
      params: { productIds: productIds.join(',') },
    });
    return response.data.data;
  }

  async create(data: MasterProductRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.post(base, data);
    return response.data.data;
  }

  async update(id: number, data: MasterProductUpdateRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.patch(`${base}/${id}`, data);
    return response.data.data;
  }

  async remove(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}`);
  }

  async uploadImage(id: number, file: File): Promise<MasterProductResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`${base}/${id}/image`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  }

  async addOption(id: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    const response = await axiosInstance.post(`${base}/${id}/options`, data);
    return response.data.data;
  }

  async updateOption(id: number, optionId: number, data: MasterOptionRequest): Promise<MasterOptionResponse> {
    const response = await axiosInstance.patch(`${base}/${id}/options/${optionId}`, data);
    return response.data.data;
  }

  async deleteOption(id: number, optionId: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}/options/${optionId}`);
  }

  async getMatrix(id: number): Promise<ListingMatrixResponse> {
    const response = await axiosInstance.get(`${base}/${id}/matrix`);
    return response.data.data;
  }

  async getCategory(id: number): Promise<MasterCategoryResponse | null> {
    const response = await axiosInstance.get(`${base}/${id}/category`);
    const data = response.data.data;
    // Backend returns { categoryId: null, categoryName: null } when unset.
    return data && data.categoryId != null ? data : null;
  }

  async setCategory(id: number, data: MasterCategoryRequest): Promise<MasterCategoryResponse> {
    const response = await axiosInstance.put(`${base}/${id}/category`, data);
    return response.data.data;
  }

  async clearCategory(id: number): Promise<void> {
    await axiosInstance.delete(`${base}/${id}/category`);
  }

  async getCategoryMeta(id: number, platform: string): Promise<CategoryMetaResponse> {
    const response = await axiosInstance.get(`${base}/${id}/category-meta`, { params: { platform } });
    return response.data.data;
  }

  async getCategorySchema(categoryId: number, platform: string): Promise<CategoryMetaSchemaResponse> {
    const response = await axiosInstance.get(`${lookupBase}/${platform}/meta`, {
      params: { categoryId },
    });
    return response.data.data;
  }

  async setCategoryAttributes(id: number, data: CategoryAttributesRequest): Promise<void> {
    await axiosInstance.patch(`${base}/${id}/category-attributes`, data);
  }

  async updateTags(id: number, data: TagsUpdateRequest): Promise<MasterProductResponse> {
    const response = await axiosInstance.patch(`${base}/${id}/tags`, data);
    return response.data.data;
  }

  // ResponseDTO<Void> — no unwrap.
  async updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void> {
    await axiosInstance.put(`${base}/${id}/registration-name-suffix`, data);
  }

  async updateShippingOverride(
    id: number,
    data: ShippingOverrideUpdateRequest,
  ): Promise<MasterProductResponse> {
    const response = await axiosInstance.patch(`${base}/${id}/shipping-override`, data);
    return response.data.data;
  }

  // Overwrite the selected channels with this master's shipping settings (77/79).
  // No body / empty listingIds = every linked channel.
  async applyShippingOverrideToChannels(
    id: number,
    data?: ShippingForceApplyRequest,
  ): Promise<ShippingForceApplyResponse> {
    const response = await axiosInstance.post(
      `${base}/${id}/shipping-override/apply-to-channels`,
      data ?? {},
    );
    return response.data.data;
  }
}
