import type { CategoryMappingUpsertRequest } from '@/domain/entities/CategoryMappingEntity';

export interface CreateCategoryRequest {
  name: string;
  // Legacy platform/platformCategoryId stay optional (2610_05/D31) — a new standard
  // category carries its platform category in `mapping` instead.
  platform?: string;
  platformCategoryId?: string;
  parentId?: number | null;
  // 2610_05/D32: required — the backend saves the category and this mapping together
  // (400 「플랫폼 카테고리를 함께 선택해야 합니다.」 without it).
  mapping: CategoryMappingUpsertRequest;
}
