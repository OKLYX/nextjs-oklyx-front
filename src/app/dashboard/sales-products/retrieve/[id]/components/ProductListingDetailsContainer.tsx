'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import { ProductListingDetailsCard } from './ProductListingDetailsCard';
import { ProductListingDetailsTable } from './ProductListingDetailsTable';

interface ProductListingDetailsContainerProps {
  id: string;
}

export function ProductListingDetailsContainer({ id }: ProductListingDetailsContainerProps) {
  const router = useRouter();
  const [listing, setListing] = useState<ProductListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const productListingUseCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setIsLoading(true);
        setError('');
        const result = await productListingUseCase.getById(parseInt(id, 10));
        setListing(result);
      } catch {
        setError('판매상품 조회에 실패했습니다. 다시 시도해주세요.');
        setListing(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [id, productListingUseCase]);

  const handleBack = () => {
    // 뒤로 가기 전에 스크롤 위치 저장
    sessionStorage.setItem('sales-products-retrieve-scroll', window.scrollY.toString());
    router.back();
  };

  const handleEdit = () => {
    // Phase 5: Open edit modal
  };

  const handleDelete = () => {
    // Phase 5: Open delete confirmation
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 돌아가기
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 돌아가기
        </button>
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-gray-200">
          상품을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProductListingDetailsCard
        listing={listing}
        isLoading={isLoading}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ProductListingDetailsTable options={listing.options} isLoading={isLoading} />
    </div>
  );
}
