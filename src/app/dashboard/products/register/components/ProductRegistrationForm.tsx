'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from '@/app/dashboard/products/[id]/components/ProductImageGallery';

interface ProductRegistrationFormValues {
  productName: string;
  barcodeId: string;
  brand?: string;
  price?: string;
  store?: string;
  unit?: string;
  volumeHeight?: string;
  volumeLong?: string;
  volumeShort?: string;
  weight?: string;
  description?: string;
}

interface ProductRegistrationFormProps {
  onSubmit: (data: CreateProductRequest) => Promise<void>;
  isLoading: boolean;
  imageUseCase: ProductImageUseCase;
  imageBuffer: File[];
  onImageBufferChange: (files: File[]) => void;
  onCheckBarcode: (barcodeId: string) => Promise<boolean>;
  onSubmitSuccess: () => void;
}

export function ProductRegistrationForm({
  onSubmit,
  isLoading,
  imageUseCase,
  imageBuffer,
  onImageBufferChange,
  onCheckBarcode,
  onSubmitSuccess,
}: ProductRegistrationFormProps) {
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [validatedBarcode, setValidatedBarcode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
    setError,
  } = useForm<ProductRegistrationFormValues>({
    defaultValues: {
      productName: '',
      barcodeId: '',
      brand: '',
      price: '',
      store: '',
      unit: '',
      volumeHeight: '',
      volumeLong: '',
      volumeShort: '',
      weight: '',
      description: '',
    },
  });

  const barcodeValue = watch('barcodeId');

  const handleCheckBarcode = useCallback(async () => {
    if (!barcodeValue || barcodeValue.trim() === '') {
      return;
    }

    setIsCheckingBarcode(true);
    try {
      const exists = await onCheckBarcode(barcodeValue);
      if (exists) {
        setBarcodeError('이미 존재하는 바코드입니다');
        setValidatedBarcode(null);
      } else {
        setBarcodeError(null);
        setValidatedBarcode(barcodeValue);
      }
    } catch {
      setBarcodeError('바코드 확인 중 오류가 발생했습니다');
      setValidatedBarcode(null);
    } finally {
      setIsCheckingBarcode(false);
    }
  }, [barcodeValue, onCheckBarcode]);

  const handleResetBarcode = useCallback(() => {
    setValue('barcodeId', '');
    setBarcodeError(null);
    setValidatedBarcode(null);
  }, [setValue]);

  const handleFormSubmit = useCallback(
    async (data: ProductRegistrationFormValues) => {
      if (!data.productName || data.productName.trim() === '') {
        setError('productName', { message: '상품명을 입력해주세요' });
        return;
      }
      if (data.barcodeId && data.barcodeId.trim() !== '' && validatedBarcode !== data.barcodeId.trim()) {
        setError('barcodeId', { message: '바코드 중복 확인을 먼저 해주세요' });
        return;
      }

      try {
        const payload: CreateProductRequest = {
          ...data,
          barcodeId: data.barcodeId || undefined,
          price: data.price ? Number(data.price) : undefined,
          volumeHeight: data.volumeHeight ? Number(data.volumeHeight) : undefined,
          volumeLong: data.volumeLong ? Number(data.volumeLong) : undefined,
          volumeShort: data.volumeShort ? Number(data.volumeShort) : undefined,
          weight: data.weight ? Number(data.weight) : undefined,
        };
        await onSubmit(payload);
        reset();
        setValidatedBarcode(null);
        onSubmitSuccess();
      } catch {
        // Error is handled in container, form state preserved
      }
    },
    [onSubmit, reset, onSubmitSuccess, setError, validatedBarcode]
  );

  useEffect(() => {
    if (validatedBarcode === null && barcodeValue && barcodeValue.trim() !== '') {
      setBarcodeError(null);
    }
  }, [barcodeValue, validatedBarcode]);

  useEffect(() => {
    if (barcodeError) {
      const timer = setTimeout(() => {
        setBarcodeError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [barcodeError]);

  const hasProductName = watch('productName') && watch('productName').trim() !== '';
  const hasBarcodeWithoutValidation = !!(barcodeValue && barcodeValue.trim() !== '' && validatedBarcode !== barcodeValue.trim());
  const isSubmitDisabled = !hasProductName || hasBarcodeWithoutValidation;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">상품등록</h1>

      {/* Required Fields */}
      <fieldset className="border border-gray-200 rounded-lg p-6 bg-white">
        <legend className="text-lg font-semibold text-gray-900 px-2">필수 항목</legend>
        <div className="space-y-4">
          {/* Product Name */}
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              상품명
            </label>
            <input
              id="productName"
              type="text"
              placeholder="상품명을 입력해주세요"
              disabled={isLoading}
              {...register('productName')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {errors.productName && <p className="text-red-600 text-sm mt-1">{errors.productName.message}</p>}
          </div>
        </div>
      </fieldset>

      {/* Optional Fields */}
      <fieldset className="border border-gray-200 rounded-lg p-6 bg-white">
        <legend className="text-lg font-semibold text-gray-900 px-2">선택 항목</legend>
        <div className="space-y-4">
          {/* Barcode ID */}
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              바코드 ID
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  id="barcodeId"
                  type="text"
                  placeholder="바코드 ID를 입력해주세요 (선택)"
                  {...register('barcodeId')}
                  disabled={validatedBarcode !== null}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              {validatedBarcode !== null ? (
                <button
                  type="button"
                  onClick={handleResetBarcode}
                  className="px-4 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  초기화
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckBarcode}
                  disabled={!barcodeValue || barcodeValue.trim() === '' || isCheckingBarcode}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isCheckingBarcode ? '확인 중...' : '중복 확인'}
                </button>
              )}
            </div>
            {barcodeError && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-red-600 text-sm flex-1">{barcodeError}</p>
                <button
                  type="button"
                  onClick={() => setBarcodeError(null)}
                  className="text-red-600 hover:text-red-700 text-lg font-bold"
                >
                  ×
                </button>
              </div>
            )}
            {errors.barcodeId && <p className="text-red-600 text-sm mt-1">{errors.barcodeId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-900 mb-1">
                브랜드
              </label>
              <input
                id="brand"
                type="text"
                placeholder="브랜드명을 입력해주세요"
                disabled={isLoading}
                {...register('brand')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-900 mb-1">
                가격
              </label>
              <input
                id="price"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0.00"
                disabled={isLoading}
                {...register('price')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-900 mb-1">
                구매처
              </label>
              <select
                id="store"
                disabled={isLoading}
                {...register('store')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">구매처 선택</option>
                <option value="이마트">이마트</option>
                <option value="코스트코">코스트코</option>
                <option value="노브랜드">노브랜드</option>
              </select>
            </div>

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-900 mb-1">
                단위
              </label>
              <select
                id="unit"
                disabled={isLoading}
                {...register('unit')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">단위 선택</option>
                <option value="G">g</option>
                <option value="KG">kg</option>
                <option value="L">l</option>
                <option value="ML">ml</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="volumeHeight" className="block text-sm font-medium text-gray-900 mb-1">
                높이
              </label>
              <input
                id="volumeHeight"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeHeight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeHeight && <p className="text-red-600 text-sm mt-1">{errors.volumeHeight.message}</p>}
            </div>

            <div>
              <label htmlFor="volumeLong" className="block text-sm font-medium text-gray-900 mb-1">
                가로
              </label>
              <input
                id="volumeLong"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeLong')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeLong && <p className="text-red-600 text-sm mt-1">{errors.volumeLong.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="volumeShort" className="block text-sm font-medium text-gray-900 mb-1">
                세로
              </label>
              <input
                id="volumeShort"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeShort')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeShort && <p className="text-red-600 text-sm mt-1">{errors.volumeShort.message}</p>}
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-900 mb-1">
                무게
              </label>
              <input
                id="weight"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('weight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.weight && <p className="text-red-600 text-sm mt-1">{errors.weight.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-1">
              설명
            </label>
            <textarea
              id="description"
              placeholder="상품 설명을 입력해주세요"
              rows={4}
              disabled={isLoading}
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </fieldset>

      {/* Image gallery (register mode = local buffer; uploaded after the product is created) */}
      <ProductImageGallery
        productId={null}
        useCase={imageUseCase}
        buffer={imageBuffer}
        onBufferChange={onImageBufferChange}
      />

      {/* Submit Button (sticky - 스크롤해도 하단에 고정) */}
      <div className="sticky bottom-0 -mb-6 bg-page border-t border-gray-200 p-4 -mx-6 px-6">
        <button
          type="submit"
          disabled={isLoading || isSubmitDisabled}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '등록 중...' : '상품 등록'}
        </button>
      </div>
    </form>
  );
}
