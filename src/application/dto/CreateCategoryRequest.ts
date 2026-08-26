export interface CreateCategoryRequest {
  name: string;
  // platform/platformCategoryId are optional (backend 55): standard-category
  // creation now needs only { name, parentId }. Kept optional so the legacy
  // Coupang-picker call sites still typecheck.
  platform?: string;
  platformCategoryId?: string;
  parentId?: number | null;
}
