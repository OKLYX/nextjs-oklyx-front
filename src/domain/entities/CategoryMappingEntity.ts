/**
 * Category mapping (표준 카테고리 × 플랫폼 → 마켓 코드) types (FEATURE_2608_06 / 44 백엔드 SSOT).
 *
 * 표준 카테고리 하나가 몰마다 다른 마켓 코드로 매핑된다. `platformCategoryName` 은
 * 조회 시점의 전체 경로 라벨(선택 사항).
 */
export interface CategoryMapping {
  platform: string;
  platformCategoryId: string;
  platformCategoryName?: string | null;
}

export interface CategoryMappingUpsertRequest {
  platform: string;
  platformCategoryId: string;
  platformCategoryName?: string | null;
}
