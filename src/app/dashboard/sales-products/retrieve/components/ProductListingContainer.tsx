'use client';

import { useMemo, useState } from 'react';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import { ProductListingSearchCard } from './ProductListingSearchCard';
import { ProductListingTable } from './ProductListingTable';

export function ProductListingContainer() {
  const [searchPlatform, setSearchPlatform] = useState('');
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedListingId, setExpandedListingId] = useState<number | null>(null);

  const productListingUseCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  const handleSearch = async () => {
    if (!searchPlatform) {
      setError('플랫폼을 선택해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setCurrentPage(0);
      const result = await productListingUseCase.getByPlatform(searchPlatform, 0, 20);
      setListings(result.content);
      setTotalPages(result.totalPages);
      setHasSearched(true);
    } catch {
      setError('판매상품 조회에 실패했습니다. 다시 시도해주세요.');
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page: number) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await productListingUseCase.getByPlatform(searchPlatform, page, 20);
      setListings(result.content);
      setCurrentPage(page);
    } catch {
      setError('판매상품 조회에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (id: number) => {
    setExpandedListingId(expandedListingId === id ? null : id);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        <ProductListingSearchCard
          searchPlatform={searchPlatform}
          onSearchChange={setSearchPlatform}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={listings.length}
        />

        <ProductListingTable
          listings={listings}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          expandedListingId={expandedListingId}
          onRowClick={handleRowClick}
        />

        {hasSearched && listings.length > 0 && totalPages > 1 && (
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
