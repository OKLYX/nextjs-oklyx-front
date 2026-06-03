'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { ProductListingForm } from './ProductListingForm';
import { ProductListingOptionForm } from './ProductListingOptionForm';
import type { CreateProductListingRequest, CreateProductListingOptionWithProductsRequest } from '@/application/dto/ProductListingDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';

interface SelectOption {
  id: number;
  name: string;
}

export function ProductListingContainer() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [listingRequest, setListingRequest] = useState<Omit<CreateProductListingRequest, 'options'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [carriers, setCarriers] = useState<SelectOption[]>([]);
  const [packages, setPackages] = useState<SelectOption[]>([]);
  const [loadingSelects, setLoadingSelects] = useState(true);

  const useCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  const sellerUseCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  useEffect(() => {
    const fetchSelectOptions = async () => {
      try {
        const [sellersRes, carriersRes, packagesRes] = await Promise.all([
          sellerUseCase.getAll(),
          axiosInstance.get('/api/carrier-rates'),
          axiosInstance.get('/api/packages'),
        ]);

        setSellers(sellersRes);
        setCarriers(carriersRes.data.data || []);
        setPackages(packagesRes.data.data || []);
      } catch (err) {
        setError('선택 옵션을 불러오지 못했습니다');
      } finally {
        setLoadingSelects(false);
      }
    };

    fetchSelectOptions();
  }, [sellerUseCase]);

  const handleListingFormSubmit = async (request: Omit<CreateProductListingRequest, 'options'>) => {
    setError('');
    setListingRequest(request);
    setCurrentStep(2);
  };

  const handleOptionsFormSubmit = async (options: CreateProductListingOptionWithProductsRequest[]) => {
    if (!listingRequest) return;

    setError('');
    setIsLoading(true);
    try {
      const request: CreateProductListingRequest = {
        ...listingRequest,
        options,
      };

      console.log('최종 요청 데이터:', JSON.stringify(request, null, 2));
      await useCase.create(request);
      router.push('/dashboard/sales-products/retrieve');
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매상품 등록에 실패했습니다';
      if (message.includes('409') || message.includes('duplicate')) {
        setError('이미 등록된 상품입니다. 다른 상품 ID를 사용해주세요.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSelects) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div className="py-8">
      {error && (
        <div className="mb-6 max-w-4xl mx-auto p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 underline text-red-600 hover:text-red-700"
          >
            닫기
          </button>
        </div>
      )}

      {currentStep === 1 && (
        <ProductListingForm
          sellers={sellers}
          carriers={carriers}
          packages={packages}
          onSubmit={handleListingFormSubmit}
          isLoading={isLoading}
        />
      )}

      {currentStep === 2 && listingRequest && (
        <ProductListingOptionForm
          listingRequest={listingRequest}
          onSubmit={handleOptionsFormSubmit}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
