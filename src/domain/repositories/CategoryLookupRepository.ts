import type { CategoryNode, CategorySuggestion } from '@/domain/entities/CategoryLookupEntity';

export interface CategoryLookupRepository {
  browse(platform: string, parentCode?: string): Promise<CategoryNode[]>;
  predict(platform: string, productName: string): Promise<CategorySuggestion[]>;
}
