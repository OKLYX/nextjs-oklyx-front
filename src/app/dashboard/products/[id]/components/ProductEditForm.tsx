'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Product } from '@/domain/entities/Product';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from './ProductImageGallery';

interface ProductEditFormValues {
  productName: string;
  barcodeId: string;
  brand: string;
  price: string;
  store: string;
  netContentUnit: string;
  packageHeight: string;
  packageLength: string;
  packageWidth: string;
  netContent: string;
  description: string;
}

interface ProductEditFormProps {
  product: Product;
  onSave: (data: UpdateProductRequest) => Promise<void>;
  onCancel: () => void;
  onCheckBarcode: (barcodeId: string) => Promise<boolean>;
  imageUseCase: ProductImageUseCase;
}

export function ProductEditForm({
  product,
  onSave,
  onCancel,
  onCheckBarcode,
  imageUseCase,
}: ProductEditFormProps) {
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
  } = useForm<ProductEditFormValues>({
    defaultValues: {
      productName: product.productName,
      barcodeId: product.barcodeId,
      brand: product.brand ?? '',
      price: product.price ? String(product.price) : '',
      store: product.store ?? '',
      netContentUnit: product.netContentUnit ?? '',
      packageHeight: product.packageHeight ? String(product.packageHeight) : '',
      packageLength: product.packageLength ? String(product.packageLength) : '',
      packageWidth: product.packageWidth ? String(product.packageWidth) : '',
      netContent: product.netContent ? String(product.netContent) : '',
      description: product.description ?? '',
    },
  });

  const barcodeValue = watch('barcodeId');

  const handleBarcodeBlur = useCallback(async () => {
    if (!barcodeValue || barcodeValue.trim() === '') {
      setBarcodeError(null);
      return;
    }

    if (barcodeValue === product.barcodeId) {
      setBarcodeError(null);
      return;
    }

    setIsCheckingBarcode(true);
    try {
      const exists = await onCheckBarcode(barcodeValue);
      setBarcodeError(exists ? '이미 존재하는 바코드입니다' : null);
    } catch {
      setBarcodeError('바코드 확인 중 오류가 발생했습니다');
    } finally {
      setIsCheckingBarcode(false);
    }
  }, [barcodeValue, onCheckBarcode, product.barcodeId]);

  useEffect(() => {
    if (barcodeValue !== product.barcodeId) {
      setBarcodeError(null);
    }
  }, [barcodeValue, product.barcodeId]);

  const handleFormSubmit = useCallback(
    async (data: ProductEditFormValues) => {
      setIsSaving(true);
      try {
        const payload: UpdateProductRequest = {
          ...data,
          price: data.price ? Number(data.price) : null,
          packageHeight: data.packageHeight ? Number(data.packageHeight) : null,
          packageLength: data.packageLength ? Number(data.packageLength) : null,
          packageWidth: data.packageWidth ? Number(data.packageWidth) : null,
          netContent: data.netContent ? Number(data.netContent) : null,
        };
        await onSave(payload);
      } catch {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">상품 수정</h1>

      <fieldset className="border border-gray-300 rounded-lg p-6 bg-gray-50">
        <legend className="text-lg font-semibold text-gray-900 px-2">필수 항목</legend>
        <div className="space-y-4">
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              바코드 ID
            </label>
            <input
              id="barcodeId"
              type="text"
              placeholder="바코드 ID를 입력해주세요 (선택)"
              {...register('barcodeId')}
              onBlur={handleBarcodeBlur}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {barcodeError && <p className="text-red-600 text-sm mt-1">{barcodeError}</p>}
          </div>

          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              상품명
            </label>
            <input
              id="productName"
              type="text"
              placeholder="상품명을 입력해주세요"
              {...register('productName')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 rounded-lg p-6 bg-white">
        <legend className="text-lg font-semibold text-gray-900 px-2">선택 항목</legend>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-900 mb-1">
                브랜드
              </label>
              <input
                id="brand"
                type="text"
                placeholder="브랜드명을 입력해주세요"
                {...register('brand')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {...register('price')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-900 mb-1">
                구매처
              </label>
              <select
                id="store"
                {...register('store')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">구매처 선택</option>
                <option value="이마트">이마트</option>
                <option value="코스트코">코스트코</option>
                <option value="노브랜드">노브랜드</option>
              </select>
            </div>

            <div>
              <label htmlFor="netContentUnit" className="block text-sm font-medium text-gray-900 mb-1">
                단위
              </label>
              <select
                id="netContentUnit"
                {...register('netContentUnit')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label htmlFor="packageHeight" className="block text-sm font-medium text-gray-900 mb-1">
                높이
              </label>
              <input
                id="packageHeight"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                {...register('packageHeight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="packageLength" className="block text-sm font-medium text-gray-900 mb-1">
                길이
              </label>
              <input
                id="packageLength"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                {...register('packageLength')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="packageWidth" className="block text-sm font-medium text-gray-900 mb-1">
                너비
              </label>
              <input
                id="packageWidth"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                {...register('packageWidth')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="netContent" className="block text-sm font-medium text-gray-900 mb-1">
                내용물 양
              </label>
              <input
                id="netContent"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                {...register('netContent')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex gap-4">
        <button type="submit" disabled={!!barcodeError || isSaving} className="btn-primary">
          {isSaving ? '저장 중...' : '저장'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          취소
        </button>
      </div>

      <ProductImageGallery productId={product.id} useCase={imageUseCase} />
    </form>
  );
}