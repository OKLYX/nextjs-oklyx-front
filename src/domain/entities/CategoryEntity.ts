export interface Category {
  id: number;
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId?: number | null;
  createdDate?: string;
  modifiedDate?: string;
}
