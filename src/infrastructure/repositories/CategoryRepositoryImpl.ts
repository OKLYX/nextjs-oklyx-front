import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryRepository } from '@/domain/repositories/CategoryRepository';
import type { CreateCategoryRequest } from '@/application/dto/CreateCategoryRequest';
import type { UpdateCategoryRequest } from '@/application/dto/UpdateCategoryRequest';

export class CategoryRepositoryImpl implements CategoryRepository {
  async getCategories(): Promise<Category[]> {
    const response = await axiosInstance.get('/api/admin/category');
    return response.data.data || [];
  }

  async getCategoryById(id: number): Promise<Category> {
    const response = await axiosInstance.get(`/api/admin/category/${id}`);
    return response.data.data;
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    const response = await axiosInstance.post('/api/admin/category', data);
    return response.data.data;
  }

  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<Category> {
    const response = await axiosInstance.patch(`/api/admin/category/${id}`, data);
    return response.data.data;
  }

  async deleteCategory(id: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/category/${id}`);
  }
}
