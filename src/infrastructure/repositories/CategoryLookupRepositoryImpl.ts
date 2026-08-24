import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CategoryLookupRepository } from '@/domain/repositories/CategoryLookupRepository';
import type { CategoryNode, CategorySuggestion } from '@/domain/entities/CategoryLookupEntity';

export class CategoryLookupRepositoryImpl implements CategoryLookupRepository {
  async browse(platform: string, parentCode?: string): Promise<CategoryNode[]> {
    const response = await axiosInstance.get(`/api/admin/category-lookup/${platform}/tree`, {
      params: parentCode ? { parentCode } : {},
    });
    return response.data.data || [];
  }

  async predict(platform: string, productName: string): Promise<CategorySuggestion[]> {
    const response = await axiosInstance.get(`/api/admin/category-lookup/${platform}/predict`, {
      params: { productName },
    });
    return response.data.data || [];
  }
}
