'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { ProductListingForm } from './ProductListingForm';
import { ProductListingOptionForm } from './ProductListingOptionForm';
import { ProductListingBundleForm } from './ProductListingBundleForm';
import type { CreateProductListingRequest, CreateProductListingOptionRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';
import type { ProductListing, ProductListingOption } from '@/domain/entities/ProductListingEntity';

interface SelectOption {
  id: number;
  name: string;
}

export function ProductListingContainer() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [listingData, setListingData] = useState<ProductListing | null>(null);
  const [optionsData, setOptionsData] = useState<ProductListingOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [carriers, setCarriers] = useState<SelectOption[]>([]);
  const [packages, setPackages] = useState<SelectOption[]>([]);
  const [loadingSelects, setLoadingSelects] = useState(true);

  const useCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  useEffect(() => {
    const fetchSelectOptions = async () => {
      try {
        const [carriersRes, packagesRes] = await Promise.all([
          axiosInstance.get('/api/carrier-rates'),
          axiosInstance.get('/api/packages'),
        ]);

        setCarriers(carriersRes.data.data || []);
        setPackages(packagesRes.data.data || []);
      } catch (err) {
        setError('선택 옵션을 불러오지 못했습니다');
      } finally {
        setLoadingSelects(false);
      }
    };

    fetchSelectOptions();
  }, []);

  const handleCreateListing = async (request: CreateProductListingRequest) => {
    setError('');
    setIsLoading(true);
    try {
      const listing = await useCase.create(request);
      setListingData(listing);
      setCurrentStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매상품 생성에 실패했습니다';
      if (message.includes('409') || message.includes('duplicate')) {
        setError('이미 등록된 상품입니다. 다른 상품 ID를 사용해주세요.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOption = async (request: CreateProductListingOptionRequest) => {
    setError('');
    try {
      return await useCase.addOption(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : '옵션 추가에 실패했습니다';
      setError(message);
      throw err;
    }
  };

  const handleAddOptionsSubmit = async (options: ProductListingOption[]) => {
    setOptionsData(options);
    setCurrentStep(3);
  };

  const handleAddProduct = async (request: CreateProductListingProductRequest) => {
    setError('');
    try {
      await useCase.addProduct(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : '상품 추가에 실패했습니다';
      setError(message);
      throw err;
    }
  };

  const handleSubmitBundle = async () => {
    setError('');
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push('/dashboard/sales-products/retrieve');
    } catch (err) {
      const message = err instanceof Error ? err.message : '등록에 실패했습니다';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSelects) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div className="py-8">
      {error && currentStep !== 1 && (
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
          carriers={carriers}
          packages={packages}
          onSubmit={handleCreateListing}
          isLoading={isLoading}
        />
      )}

      {currentStep === 2 && listingData && (
        <ProductListingOptionForm
          listingId={listingData.id}
          existingOptions={optionsData}
          onAddOption={handleAddOption}
          onRemoveOption={() => {}}
          onSubmit={handleAddOptionsSubmit}
          isLoading={isLoading}
        />
      )}

      {currentStep === 3 && listingData && optionsData.length > 0 && (
        <ProductListingBundleForm
          listingId={listingData.id}
          options={optionsData}
          onAddProduct={handleAddProduct}
          onSubmit={handleSubmitBundle}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
