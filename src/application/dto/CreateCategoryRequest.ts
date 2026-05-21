export interface CreateCategoryRequest {
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId?: number | null;
}
