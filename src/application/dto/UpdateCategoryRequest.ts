export interface UpdateCategoryRequest {
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId?: number | null;
}
