import type { CategoryMappingRepository } from '@/domain/repositories/CategoryMappingRepository';
import type {
  CategoryMapping,
  CategoryMappingUpsertRequest,
} from '@/domain/entities/CategoryMappingEntity';

export class CategoryMappingUseCase {
  constructor(private repository: CategoryMappingRepository) {}

  async getMappings(categoryId: number): Promise<CategoryMapping[]> {
    return this.repository.getMappings(categoryId);
  }

  async upsertMapping(
    categoryId: number,
    data: CategoryMappingUpsertRequest
  ): Promise<CategoryMapping> {
    return this.repository.upsertMapping(categoryId, data);
  }

  async deleteMapping(categoryId: number, platform: string): Promise<void> {
    return this.repository.deleteMapping(categoryId, platform);
  }
}
