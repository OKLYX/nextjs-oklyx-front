import type {
  CategoryMapping,
  CategoryMappingUpsertRequest,
} from '@/domain/entities/CategoryMappingEntity';

export interface CategoryMappingRepository {
  getMappings(categoryId: number): Promise<CategoryMapping[]>;
  upsertMapping(categoryId: number, data: CategoryMappingUpsertRequest): Promise<CategoryMapping>;
  deleteMapping(categoryId: number, platform: string): Promise<void>;
}
