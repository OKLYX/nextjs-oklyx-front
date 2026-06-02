'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateProductListingRequest } from '@/application/dto/ProductListingDTOs';

const PLATFORMS = ['COUPANG', 'GMARKET', 'AUCTION', 'SMARTSTORE'];

const PLATFORM_CATEGORIES: Record<string, Array<{ id: number; name: string }>> = {
  COUPANG: [
    { id: 1, name: '쿠팡 - 의류' },
    { id: 2, name: '쿠팡 - 신발' },
    { id: 3, name: '쿠팡 - 액세서리' },
  ],
  GMARKET: [
    { id: 4, name: '지마켓 - 의류' },
    { id: 5, name: '지마켓 - 신발' },
  ],
  AUCTION: [
    { id: 6, name: '옥션 - 의류' },
    { id: 7, name: '옥션 - 잡화' },
  ],
  SMARTSTORE: [
    { id: 8, name: '스마트스토어 - 의류' },
    { id: 9, name: '스마트스토어 - 신발' },
  ],
};

const productListingSchema = z.object({
  platform: z.string().min(1, '플랫폼을 선택해주세요'),
  platformProductId: z.string().min(1, '상품 ID를 입력해주세요').max(255),
  categoryId: z.coerce.number().optional(),
  deliveryId: z.coerce.number().optional(),
  packageId: z.coerce.number().optional(),
});

type ProductListingFormValues = z.infer<typeof productListingSchema>;

interface ProductListingFormProps {
  carriers: Array<{ id: number; name: string }>;
  packages: Array<{ id: number; name: string }>;
  onSubmit: (data: CreateProductListingRequest) => Promise<void>;
  isLoading?: boolean;
}

export function ProductListingForm({
  carriers,
  packages,
  onSubmit,
  isLoading = false,
}: ProductListingFormProps) {
  const [submitError, setSubmitError] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ProductListingFormValues>({
    resolver: zodResolver(productListingSchema),
    defaultValues: {
      platform: '',
      platformProductId: '',
      categoryId: undefined,
      deliveryId: carriers.length > 0 ? carriers[0].id : undefined,
      packageId: packages.length > 0 ? packages[0].id : undefined,
    },
  });

  const platform = watch('platform');

  const filteredCategories = useMemo(() => {
    if (!platform) return [];
    return PLATFORM_CATEGORIES[platform] || [];
  }, [platform]);

  const onFormSubmit = async (values: ProductListingFormValues) => {
    setSubmitError('');
    try {
      const request: CreateProductListingRequest = {
        platform: values.platform,
        platformProductId: values.platformProductId,
        ...(values.categoryId && { categoryId: values.categoryId }),
        ...(values.deliveryId && { deliveryId: values.deliveryId }),
        ...(values.packageId && { packageId: values.packageId }),
      };
      await onSubmit(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : '등록에 실패했습니다';
      setSubmitError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">판매상품 정보 (Step 1/3)</h2>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            플랫폼 *
          </label>
          <select
            {...register('platform', {
              onChange: (e) => setSelectedPlatform(e.target.value),
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="">플랫폼 선택...</option>
            {PLATFORMS.map((plat) => (
              <option key={plat} value={plat}>
                {plat}
              </option>
            ))}
          </select>
          {errors.platform && (
            <p className="mt-1 text-xs text-red-600">{errors.platform.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상품 ID *
          </label>
          <input
            {...register('platformProductId')}
            type="text"
            placeholder="12345678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.platformProductId && (
            <p className="mt-1 text-xs text-red-600">{errors.platformProductId.message}</p>
          )}
        </div>

        {platform && filteredCategories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              {...register('categoryId')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">카테고리 선택...</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
            )}
          </div>
        )}

        {carriers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              배송사 *
            </label>
            <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-900">{carriers[0]?.name || '선택 없음'}</p>
              <p className="text-xs text-gray-500">등록된 배송사가 자동 선택됩니다</p>
            </div>
            <input {...register('deliveryId')} type="hidden" />
          </div>
        )}

        {packages.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              패키지 *
            </label>
            <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-900">{packages[0]?.name || '선택 없음'}</p>
              <p className="text-xs text-gray-500">등록된 패키지가 자동 선택됩니다</p>
            </div>
            <input {...register('packageId')} type="hidden" />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '처리 중...' : '다음 (옵션 추가) →'}
        </button>
      </form>
    </div>
  );
}
