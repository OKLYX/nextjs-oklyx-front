/**
 * Normalized marketplace category lookup types (FEATURE_2608_06 / 45 백엔드 SSOT).
 *
 * 백엔드 `category-lookup` 컨트롤러가 플랫폼 무관 정규화 형태로 반환한다.
 * - `CategoryNode`: 트리 드릴다운 자식 (leaf=true 면 선택 후보).
 * - `CategorySuggestion`: 상품명 추천 후보 (namePath=전체 경로 라벨).
 */
export interface CategoryNode {
  platformCategoryId: string;
  name: string;
  leaf: boolean;
}

export interface CategorySuggestion {
  platformCategoryId: string;
  name: string;
  namePath: string;
}
