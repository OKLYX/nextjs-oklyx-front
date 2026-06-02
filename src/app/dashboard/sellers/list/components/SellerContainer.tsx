'use client';

import { useMemo, useState } from 'react';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { CreateSellerRequest } from '@/application/dto/SellerDTOs';
import { SellerSearchCard } from './SellerSearchCard';
import { SellerTable } from './SellerTable';
import { CreateSellerModal } from './CreateSellerModal';
import { SellerDetailsModal } from './SellerDetailsModal';

export function SellerContainer() {
  const [searchName, setSearchName] = useState('');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);

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


  const handleCreateSubmit = async (data: CreateSellerRequest) => {
    try {
      setIsModalLoading(true);
      await sellerUseCase.create(data);
      setIsCreateModalOpen(false);
      setHasSearched(false);
      setSellers([]);
    } catch (err) {
      throw err;
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleRowClick = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedSellerId(null);
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
          onCreateClick={() => setIsCreateModalOpen(true)}
        />

        <SellerTable
          sellers={sellers}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          onRowClick={handleRowClick}
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

      <CreateSellerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={isModalLoading}
      />

      <SellerDetailsModal
        isOpen={isDetailsModalOpen}
        sellerId={selectedSellerId}
        onClose={handleCloseDetailsModal}
      />
    </div>
  );
}
