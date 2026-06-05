'use client';

import { useMemo, useState, useEffect } from 'react';
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

  // 페이지 진입 시 검색 상태와 스크롤 위치 복원
  useEffect(() => {
    const restoreState = async () => {
      try {
        // 수정/삭제 후 돌아온 경우 이전 검색 재실행
        const refreshFlag = sessionStorage.getItem('refresh-product-listing');
        if (refreshFlag === 'true') {
          sessionStorage.removeItem('refresh-product-listing');

          // 저장된 검색 상태 확인
          const savedState = sessionStorage.getItem('sales-products-retrieve-state');
          if (savedState) {
            try {
              const state = JSON.parse(savedState);
              // 이전 플랫폼으로 자동 재검색
              if (state.searchPlatform) {
                setSearchPlatform(state.searchPlatform);

                // 비동기로 재검색 실행
                setTimeout(async () => {
                  try {
                    const result = await productListingUseCase.getByPlatform(state.searchPlatform, 0, 20);
                    setListings(result.content);
                    setTotalPages(result.totalPages);
                    setHasSearched(true);
                    setCurrentPage(0);
                  } catch (err) {
                    console.error('Failed to refresh listings:', err);
                  }
                }, 0);
              }
              sessionStorage.removeItem('sales-products-retrieve-state');
            } catch (err) {
              console.error('Failed to parse saved state:', err);
            }
          }
          return;
        }

        // 저장된 검색 상태 복원
        const savedState = sessionStorage.getItem('sales-products-retrieve-state');
        if (savedState) {
          const state = JSON.parse(savedState);
          setSearchPlatform(state.searchPlatform);
          setListings(state.listings);
          setHasSearched(state.hasSearched);
          setCurrentPage(state.currentPage);
          setTotalPages(state.totalPages);
          sessionStorage.removeItem('sales-products-retrieve-state');
        }
      } catch (err) {
        console.error('Failed to restore search state:', err);
      }

      // 스크롤 위치 복원
      const savedScrollPosition = sessionStorage.getItem('sales-products-retrieve-scroll');
      if (savedScrollPosition) {
        const scrollPos = parseInt(savedScrollPosition, 10);
        setTimeout(() => {
          window.scrollTo({ top: scrollPos, behavior: 'auto' });
        }, 100);
        sessionStorage.removeItem('sales-products-retrieve-scroll');
      }
    };

    // 페이지 로드 완료 후 상태 복원
    if (document.readyState === 'complete') {
      restoreState();
    } else {
      window.addEventListener('load', restoreState);
      return () => window.removeEventListener('load', restoreState);
    }
  }, [productListingUseCase]);

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

  const handleRowClick = async (id: number) => {
    if (expandedListingId === id) {
      setExpandedListingId(null);
    } else {
      setExpandedListingId(id);
      // 옵션 데이터 로드
      try {
        const options = await productListingUseCase.getOptions(id);
        setListings((prevListings) =>
          prevListings.map((listing) =>
            listing.id === id ? { ...listing, options } : listing
          )
        );
      } catch {
        console.error('옵션 조회에 실패했습니다.');
      }
    }
  };

  const handleSaveStateBeforeNavigation = () => {
    // 상태 저장 (detail page 이동 전)
    const state = {
      searchPlatform,
      listings,
      hasSearched,
      currentPage,
      totalPages,
    };
    sessionStorage.setItem('sales-products-retrieve-state', JSON.stringify(state));
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
          onSaveState={handleSaveStateBeforeNavigation}
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
