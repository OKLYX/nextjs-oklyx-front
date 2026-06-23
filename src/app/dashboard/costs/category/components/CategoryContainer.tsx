'use client';

import { useState, useMemo } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CreateCategoryRequest } from '@/application/dto/CreateCategoryRequest';
import type { UpdateCategoryRequest } from '@/application/dto/UpdateCategoryRequest';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CategorySearchCard } from './CategorySearchCard';
import { CategoryTable } from './CategoryTable';
import { CreateCategoryModal } from './CreateCategoryModal';
import { EditCategoryModal } from './EditCategoryModal';

export function CategoryContainer() {
  const [searchName, setSearchName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  const categoryUseCase = useMemo(() => {
    const repository = new CategoryRepositoryImpl();
    return new CategoryUseCase(repository);
  }, []);

  const handleSearch = async () => {
    setError('');
    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await categoryUseCase.getCategories();
      setCategories(data);
    } catch {
      setError('카테고리 정보를 조회할 수 없습니다.');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchName.toLowerCase())
  );

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateCategory = async (data: CreateCategoryRequest) => {
    setIsSubmitting(true);
    try {
      await categoryUseCase.createCategory(data);
      handleCloseCreateModal();
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (category: Category) => {
    setSelectedCategory(category);
    setSelectedCategoryId(category.id);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCategory(null);
    setSelectedCategoryId(undefined);
  };

  const handleUpdateCategory = async (data: UpdateCategoryRequest) => {
    if (!selectedCategory) return;
    setIsSubmittingEdit(true);
    try {
      await categoryUseCase.updateCategory(selectedCategory.id, data);
      handleCloseEditModal();
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenDeleteConfirm = () => {
    setIsDeleteConfirmOpen(true);
    setDeleteError(undefined);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false);
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      setIsDeletingCategory(true);
      setDeleteError(undefined);

      await categoryUseCase.deleteCategory(categoryId);

      // 성공 시 모든 상태 초기화
      setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
      setIsEditModalOpen(false);
      setSelectedCategory(null);
      setSelectedCategoryId(undefined);
      setIsDeleteConfirmOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '삭제에 실패했습니다';
      setDeleteError(message);
      // 에러 시: Dialog는 닫고 Modal 유지 (사용자가 재시도 가능)
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <PageContainer contentClassName="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">카테고리</h1>
          <p className="text-gray-600">상품 카테고리를 관리합니다.</p>
        </div>

        <CategorySearchCard
          searchName={searchName}
          onSearchNameChange={setSearchName}
          onSearch={handleSearch}
          onAddClick={handleOpenCreateModal}
          isLoading={isLoading}
        />

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {hasSearched && (
          <CategoryTable
            categories={filteredCategories}
            isLoading={isLoading}
            selectedId={selectedCategoryId}
            onRowClick={handleOpenEditModal}
          />
        )}

        {isCreateModalOpen && (
          <CreateCategoryModal
            isOpen={isCreateModalOpen}
            onClose={handleCloseCreateModal}
            onSubmit={handleCreateCategory}
            isSubmitting={isSubmitting}
            categories={categories}
          />
        )}

        {isEditModalOpen && selectedCategory && (
          <EditCategoryModal
            isOpen={isEditModalOpen}
            category={selectedCategory}
            onClose={handleCloseEditModal}
            onSubmit={handleUpdateCategory}
            onDelete={handleDeleteCategory}
            isLoading={isSubmittingEdit}
            isDeletingCategory={isDeletingCategory}
            isDeleteConfirmOpen={isDeleteConfirmOpen}
            onOpenDeleteConfirm={handleOpenDeleteConfirm}
            onCloseDeleteConfirm={handleCloseDeleteConfirm}
            deleteError={deleteError}
            categories={categories}
          />
        )}
    </PageContainer>
  );
}
