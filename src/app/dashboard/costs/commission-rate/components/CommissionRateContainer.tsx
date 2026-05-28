'use client';

import { useState, useMemo } from 'react';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import { CommissionRateUseCase } from '@/application/usecases/CommissionRateUseCase';
import { CommissionRateRepositoryImpl } from '@/infrastructure/repositories/CommissionRateRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CommissionRateSearchCard } from './CommissionRateSearchCard';
import { CommissionRateTable } from './CommissionRateTable';
import { CreateCommissionRateModal } from './CreateCommissionRateModal';
import type { CreateCommissionRateFormData } from '@/application/schemas/CommissionRateSchema';

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
    data: CreateCommissionRateFormData
  ) => {
    setIsSubmitting(true);
    try {
      await useCase.createCommissionRate(data);
      setIsCreateModalOpen(false);
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCount = hasSearched ? commissionRates.length : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">수수료</h1>
        <p className="text-sm text-gray-600 mt-1">수수료 정보를 조회하고 관리합니다.</p>
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
      />

      <CreateCommissionRateModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSubmit={handleCreateCommissionRate}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
