import type {
  CategoryMapping,
  CategoryMappingUpsertRequest,
} from '@/domain/entities/CategoryMappingEntity';

export interface CategoryMappingRepository {
  getMappings(categoryId: number): Promise<CategoryMapping[]>;
  upsertMapping(categoryId: number, data: CategoryMappingUpsertRequest): Promise<CategoryMapping>;
  deleteMapping(categoryId: number, platform: string): Promise<void>;
  /** FEATURE_2610_34 / D7: [기억 지우기] of a Coupang category code. */
  clearGrandTotalOmitted(code: string): Promise<void>;
}
