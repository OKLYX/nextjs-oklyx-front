'use client';

import { useState, useMemo } from 'react';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import { CommissionRateUseCase } from '@/application/usecases/CommissionRateUseCase';
import { CommissionRateRepositoryImpl } from '@/infrastructure/repositories/CommissionRateRepositoryImpl';
import { CommissionRateSearchCard } from './CommissionRateSearchCard';
import { CommissionRateTable } from './CommissionRateTable';

export function CommissionRateContainer() {
  const [searchPlatform, setSearchPlatform] = useState('');
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const useCase = useMemo(() => {
    return new CommissionRateUseCase(new CommissionRateRepositoryImpl());
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await useCase.getCommissionRates();
      const filtered = data.filter((rate) =>
        rate.platform.toLowerCase().includes(searchPlatform.toLowerCase())
      );
      setCommissionRates(filtered);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회에 실패했습니다.');
      setCommissionRates([]);
    } finally {
      setIsLoading(false);
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
        searchPlatform={searchPlatform}
        onSearchChange={setSearchPlatform}
        onSearch={handleSearch}
        isLoading={isLoading}
        resultCount={filteredCount}
        hasSearched={hasSearched}
      />

      <CommissionRateTable
        commissionRates={commissionRates}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
      />
    </div>
  );
}
