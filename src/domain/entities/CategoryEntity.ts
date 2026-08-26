export interface Category {
  id: number;
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId?: number | null;
  createdDate?: string;
  modifiedDate?: string;
}

/**
 * One node of the oclyx standard-category tree browse (backend 52).
 * Kept thin (id/name/leaf only) — mapping badges / parent info are fetched
 * separately (never carried on the node). See CategoryTreeColumns.
 */
export interface CategoryTreeNode {
  id: number;
  name: string;
  leaf: boolean;
}
