'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateProductListingOptionRequest } from '@/application/dto/ProductListingDTOs';
import type { ProductListingOption } from '@/domain/entities/ProductListingEntity';

const optionSchema = z.object({
  optionName: z.string().min(1, '옵션명을 입력해주세요').max(100),
  sellingPrice: z.coerce.number().min(0.01, '판매가는 0보다 커야 합니다'),
  platformOptionId: z.string().optional(),
});

type OptionFormValues = z.infer<typeof optionSchema>;

interface ProductListingOptionFormProps {
  listingId: number;
  existingOptions: ProductListingOption[];
  onAddOption: (request: CreateProductListingOptionRequest) => Promise<ProductListingOption>;
  onRemoveOption: (index: number) => void;
  onSubmit: (options: ProductListingOption[]) => Promise<void>;
  isLoading?: boolean;
}

export function ProductListingOptionForm({
  listingId,
  existingOptions,
  onAddOption,
  onRemoveOption,
  onSubmit,
  isLoading = false,
}: ProductListingOptionFormProps) {
  const [submitError, setSubmitError] = useState('');
  const [options, setOptions] = useState<ProductListingOption[]>(existingOptions);
  const [isAdding, setIsAdding] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<OptionFormValues>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      optionName: '',
      sellingPrice: undefined,
      platformOptionId: '',
    },
  });

  const handleAddOption = async (values: OptionFormValues) => {
    setSubmitError('');
    setIsAdding(true);
    try {
      const request: CreateProductListingOptionRequest = {
        productListingId: listingId,
        optionName: values.optionName,
        sellingPrice: values.sellingPrice,
        ...(values.platformOptionId && { platformOptionId: values.platformOptionId }),
      };
      const newOption = await onAddOption(request);
      setOptions([...options, newOption]);
      reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : '옵션 추가에 실패했습니다';
      setSubmitError(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
    onRemoveOption(index);
  };

  const handleSubmitOptions = async () => {
    if (options.length === 0) {
      setSubmitError('최소 1개 이상의 옵션을 추가해주세요');
      return;
    }
    try {
      await onSubmit(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : '제출에 실패했습니다';
      setSubmitError(message);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">판매상품 옵션 (Step 2/3)</h2>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="space-y-6">
        {options.length > 0 && (
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={option.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{option.optionName}</p>
                    <p className="text-sm text-gray-600">
                      판매가: {option.sellingPrice.toLocaleString()}원
                    </p>
                    {option.platformOptionId && (
                      <p className="text-sm text-gray-600">
                        플랫폼 ID: {option.platformOptionId}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    disabled={isLoading || isAdding}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="font-medium mb-4">옵션 추가</h3>
          <form onSubmit={handleSubmit(handleAddOption)} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                옵션명 *
              </label>
              <input
                {...register('optionName')}
                type="text"
                placeholder="Blue M"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isAdding}
              />
              {errors.optionName && (
                <p className="mt-1 text-xs text-red-600">{errors.optionName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                판매가 *
              </label>
              <input
                {...register('sellingPrice')}
                type="number"
                step="0.01"
                placeholder="29900"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isAdding}
              />
              {errors.sellingPrice && (
                <p className="mt-1 text-xs text-red-600">{errors.sellingPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                플랫폼 옵션 ID
              </label>
              <input
                {...register('platformOptionId')}
                type="text"
                placeholder="option_abc123"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isAdding}
              />
              {errors.platformOptionId && (
                <p className="mt-1 text-xs text-red-600">{errors.platformOptionId.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isAdding}
              className="w-full bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? '추가 중...' : '+ 옵션 추가'}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={handleSubmitOptions}
          disabled={isLoading || options.length === 0}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '처리 중...' : '다음 (상품 번들 구성) →'}
        </button>
      </div>
    </div>
  );
}
