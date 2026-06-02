'use client';

import { useMemo, useState } from 'react';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import { SellerSearchCard } from './SellerSearchCard';
import { SellerTable } from './SellerTable';

export function SellerContainer() {
  const [searchName, setSearchName] = useState('');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const sellerUseCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError('');
      setCurrentPage(0);
      const result = await sellerUseCase.getAll();
      setSellers(result);
      setTotalPages(1);
      setHasSearched(true);
    } catch {
      setError('판매자 조회에 실패했습니다. 다시 시도해주세요.');
      setSellers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page: number) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await sellerUseCase.getAllPaginated(searchName, page, 20);
      setSellers(result.content);
      setCurrentPage(page);
    } catch {
      setError('판매자 조회에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (seller: Seller) => {
    console.log('View seller:', seller);
  };

  const handleEdit = (seller: Seller) => {
    console.log('Edit seller:', seller);
  };

  const handleDelete = (id: number) => {
    console.log('Delete seller:', id);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        <SellerSearchCard
          searchName={searchName}
          onSearchChange={setSearchName}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={sellers.length}
        />

        <SellerTable
          sellers={sellers}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {hasSearched && sellers.length > 0 && totalPages > 1 && (
          <div className="bg-white rounded-lg shadow px-6 py-4 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0 || isLoading}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
            >
              ← 이전
            </button>

            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i)}
                disabled={isLoading}
                className={`px-2 py-1 text-sm rounded transition-colors ${
                  currentPage === i
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1 || isLoading}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
            >
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
