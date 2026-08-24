import type { CategoryLookupRepository } from '@/domain/repositories/CategoryLookupRepository';
import type { CategoryNode, CategorySuggestion } from '@/domain/entities/CategoryLookupEntity';

export class CategoryLookupUseCase {
  constructor(private repository: CategoryLookupRepository) {}

  async browse(platform: string, parentCode?: string): Promise<CategoryNode[]> {
    return this.repository.browse(platform, parentCode);
  }

  async predict(platform: string, productName: string): Promise<CategorySuggestion[]> {
    return this.repository.predict(platform, productName);
  }
}
