import type { Category } from '@/domain/entities/CategoryEntity';
import type { CreateCategoryRequest } from '../dto/CreateCategoryRequest';
import type { UpdateCategoryRequest } from '../dto/UpdateCategoryRequest';
import type { CategoryRepository } from '@/domain/repositories/CategoryRepository';

export class CategoryUseCase {
  constructor(private repository: CategoryRepository) {}

  async getCategories(): Promise<Category[]> {
    return this.repository.getCategories();
  }

  async getCategoryById(id: number): Promise<Category> {
    return this.repository.getCategoryById(id);
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return this.repository.createCategory(data);
  }

  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<Category> {
    return this.repository.updateCategory(id, data);
  }

  async deleteCategory(id: number): Promise<void> {
    return this.repository.deleteCategory(id);
  }
}
