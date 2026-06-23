'use client';

import { useState, useMemo } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import { CommissionRateUseCase } from '@/application/usecases/CommissionRateUseCase';
import { CommissionRateRepositoryImpl } from '@/infrastructure/repositories/CommissionRateRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CommissionRateSearchCard } from './CommissionRateSearchCard';
import { CommissionRateTable } from './CommissionRateTable';
import { CreateCommissionRateModal } from './CreateCommissionRateModal';
import { EditCommissionRateModal } from './EditCommissionRateModal';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import type { CreateCommissionRateFormData, UpdateCommissionRateFormData } from '@/application/schemas/CommissionRateSchema';

export function CommissionRateContainer() {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCommissionRate, setSelectedCommissionRate] = useState<CommissionRate | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingRate, setIsDeletingRate] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const useCase = useMemo(() => {
    return new CommissionRateUseCase(new CommissionRateRepositoryImpl());
  }, []);

  const categoryUseCase = useMemo(() => {
    return new CategoryUseCase(new CategoryRepositoryImpl());
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [commissionRatesData, categoriesData] = await Promise.all([
        useCase.getCommissionRates(),
        categoryUseCase.getCategories(),
      ]);

      setCategories(categoriesData);

      let filtered = commissionRatesData;

      if (selectedPlatform) {
        filtered = filtered.filter(rate => rate.platform === selectedPlatform);
      }

      if (searchCategory) {
        filtered = filtered.filter(rate => {
          const categoryName = categoriesData.find(cat => cat.id === rate.categoryId)?.name || '';
          return categoryName.toLowerCase().includes(searchCategory.toLowerCase());
        });
      }

      const uniquePlatforms = Array.from(new Set(commissionRatesData.map(rate => rate.platform))).sort();
      setPlatforms(uniquePlatforms);

      setCommissionRates(filtered);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회에 실패했습니다.');
      setCommissionRates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateCommissionRate = async (
    data: CreateCommissionRateFormData | UpdateCommissionRateFormData
  ) => {
    setIsSubmitting(true);
    try {
      await useCase.createCommissionRate(data as CreateCommissionRateFormData);
      setIsCreateModalOpen(false);
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (commissionRate: CommissionRate) => {
    setSelectedCommissionRate(commissionRate);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCommissionRate(null);
  };

  const handleEditCommissionRate = async (data: UpdateCommissionRateFormData) => {
    if (!selectedCommissionRate) {
      throw new Error('선택된 수수료가 없습니다');
    }

    setIsSubmittingEdit(true);
    try {
      await useCase.updateCommissionRate(selectedCommissionRate.id, data);
      handleCloseEditModal();
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenDeleteConfirm = () => {
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false);
    setDeleteError(null);
  };

  const handleDeleteCommissionRate = async () => {
    if (!selectedCommissionRate) {
      setDeleteError('선택된 수수료가 없습니다');
      return;
    }

    setIsDeletingRate(true);
    setDeleteError(null);
    try {
      await useCase.deleteCommissionRate(selectedCommissionRate.id);
      handleCloseDeleteConfirm();
      handleCloseEditModal();
      await handleSearch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다';
      setDeleteError(errorMessage);
    } finally {
      setIsDeletingRate(false);
    }
  };

  const filteredCount = hasSearched ? commissionRates.length : 0;

  return (
    <PageContainer contentClassName="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">수수료</h1>
        <p className="text-gray-600">수수료 정보를 조회하고 관리합니다.</p>
      </div>

      <CommissionRateSearchCard
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        searchCategory={searchCategory}
        onCategorySearchChange={setSearchCategory}
        platforms={platforms}
        onSearch={handleSearch}
        isLoading={isLoading}
        resultCount={filteredCount}
        hasSearched={hasSearched}
        onCreateClick={handleOpenCreateModal}
      />

      <CommissionRateTable
        commissionRates={commissionRates}
        categories={categories}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
        selectedId={selectedCommissionRate?.id}
        onRowClick={handleOpenEditModal}
      />

      <CreateCommissionRateModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSubmit={handleCreateCommissionRate}
        isSubmitting={isSubmitting}
      />

      <EditCommissionRateModal
        isOpen={isEditModalOpen}
        commissionRate={selectedCommissionRate}
        onClose={handleCloseEditModal}
        onSubmit={handleEditCommissionRate}
        onOpenDeleteConfirm={handleOpenDeleteConfirm}
        isLoading={isSubmittingEdit}
        isDeletingRate={isDeletingRate}
      />

      <DeleteConfirmationDialog
        isOpen={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDeleteCommissionRate}
        isLoading={isDeletingRate}
        error={deleteError || undefined}
      />
    </PageContainer>
  );
}
