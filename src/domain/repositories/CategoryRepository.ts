import type { Category } from '@/domain/entities/CategoryEntity';
import type { CreateCategoryRequest } from '@/application/dto/CreateCategoryRequest';
import type { UpdateCategoryRequest } from '@/application/dto/UpdateCategoryRequest';

export interface CategoryRepository {
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category>;
  createCategory(data: CreateCategoryRequest): Promise<Category>;
  updateCategory(id: number, data: UpdateCategoryRequest): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
}
