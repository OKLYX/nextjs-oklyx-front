'use client';

import { useState, useMemo } from 'react';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CreateCategoryRequest } from '@/application/dto/CreateCategoryRequest';
import type { UpdateCategoryRequest } from '@/application/dto/UpdateCategoryRequest';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CategorySearchCard } from './CategorySearchCard';
import { CategoryTable } from './CategoryTable';
import { CreateCategoryModal } from './CreateCategoryModal';
import { EditCategoryModal } from './EditCategoryModal';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

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
    setSelectedCategoryId(null);
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

  const handleOpenDeleteConfirm = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false);
    setCategoryToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    setDeleteError(null);

    try {
      await categoryUseCase.deleteCategory(categoryToDelete.id);
      handleCloseDeleteConfirm();
      await handleSearch();
    } catch (err) {
      const message = err instanceof Error ? err.message : '삭제에 실패했습니다.';
      setDeleteError(message);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
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
            onClose={handleCloseEditModal}
            onSubmit={handleUpdateCategory}
            isSubmitting={isSubmittingEdit}
            category={selectedCategory}
            categories={categories}
          />
        )}

        {isDeleteConfirmOpen && categoryToDelete && (
          <DeleteConfirmationDialog
            isOpen={isDeleteConfirmOpen}
            onClose={handleCloseDeleteConfirm}
            onConfirm={handleConfirmDelete}
            isDeleting={isDeletingCategory}
            error={deleteError}
            categoryName={categoryToDelete.name}
          />
        )}
      </div>
    </div>
  );
}
