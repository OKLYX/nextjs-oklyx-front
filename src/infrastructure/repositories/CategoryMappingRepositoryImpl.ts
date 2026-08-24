import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CategoryMappingRepository } from '@/domain/repositories/CategoryMappingRepository';
import type {
  CategoryMapping,
  CategoryMappingUpsertRequest,
} from '@/domain/entities/CategoryMappingEntity';

export class CategoryMappingRepositoryImpl implements CategoryMappingRepository {
  async getMappings(categoryId: number): Promise<CategoryMapping[]> {
    const response = await axiosInstance.get(
      `/api/admin/category-mappings/categories/${categoryId}/mappings`
    );
    return response.data.data || [];
  }

  async upsertMapping(
    categoryId: number,
    data: CategoryMappingUpsertRequest
  ): Promise<CategoryMapping> {
    const response = await axiosInstance.put(
      `/api/admin/category-mappings/categories/${categoryId}/mappings`,
      data
    );
    return response.data.data;
  }

  async deleteMapping(categoryId: number, platform: string): Promise<void> {
    await axiosInstance.delete(
      `/api/admin/category-mappings/categories/${categoryId}/mappings/${platform}`
    );
  }
}
