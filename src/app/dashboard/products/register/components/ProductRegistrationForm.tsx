'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from '@/app/dashboard/products/[id]/components/ProductImageGallery';
import { Input } from '@/presentation/components/ui/Input';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';

/**
 * 등록 폼의 칸 = 값 타입. 🔴 `export` 다 — 폼 자신이 `useForm<…>` 에서 쓰고, 전역 도구 패널의
 * [채우기] 가 같은 칸 이름을 patch 키로 넘긴다(FEATURE_2609_67 · 2609_68).
 * 값은 전부 문자열이다(숫자 변환은 제출 시점에만).
 */
export interface ProductRegistrationFormValues {
  productName: string;
  barcodeId: string;
  brand?: string;
  price?: string;
  store?: string;
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
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
  /** 전역 도구 패널에서 끌어다 놓은 마켓 사진 URL. 컨테이너가 소유한다(`imageBuffer` 와 같은 모양). */
  pickedImageUrls: string[];
  onPickedImageUrlsChange: (urls: string[]) => void;
}

export function ProductRegistrationForm({
  onSubmit,
  isLoading,
  imageUseCase,
  imageBuffer,
  onImageBufferChange,
  onCheckBarcode,
  onSubmitSuccess,
  // 🔴 컨테이너가 소유한다 — 폼은 갤러리로 내려보내기만 하고, 저장 직후 서버로 보내는 것도 컨테이너다.
  pickedImageUrls,
  onPickedImageUrlsChange,
}: ProductRegistrationFormProps) {
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  /** 도구 패널에서 끌어다 놓은 마켓 사진 — 같은 사진을 두 번 놓아도 한 장이다. */
  const handleUrlDrop = useCallback(
    (url: string) => {
      if (pickedImageUrls.includes(url)) return;
      onPickedImageUrlsChange([...pickedImageUrls, url]);
    },
    [pickedImageUrls, onPickedImageUrlsChange],
  );

  const handleUrlRemove = useCallback(
    (url: string) => onPickedImageUrlsChange(pickedImageUrls.filter((u) => u !== url)),
    [pickedImageUrls, onPickedImageUrlsChange],
  );
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
      netContentUnit: '',
      packageHeight: '',
      packageLength: '',
      packageWidth: '',
      netContent: '',
      description: '',
    },
  });

  // 전역 도구 패널(FEATURE_2609_68)에 손을 내민다: 이 화면이 떠 있는 동안만 [채우기] 가 값을 넣는다.
  const setFillTarget = useToolPanelStore((s) => s.setFillTarget);
  useEffect(() => {
    setFillTarget((patch) => {
      // 🔴 patch 에 담긴 칸만 건드린다. 담긴 칸은 이미 값이 있어도 **덮어쓴다** — 일부러 그 버튼을
      //    누른 것이다(선례: ProductEditForm 의 클립보드 채우기와 같은 판단).
      //    "값이 있으면 건너뛰기" 가드를 새로 만들지 말 것.
      Object.entries(patch).forEach(([key, value]) =>
        setValue(key as never, value as never, { shouldDirty: true }),
      );
    });
    // 🔴 나갈 때 반드시 지운다 — 남으면 죽은 폼에 setValue 한다.
    return () => setFillTarget(null);
  }, [setFillTarget, setValue]);

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
          // 치수·내용물 양은 문자열 컬럼이다("160mm") → 숫자로 바꾸지 않는다.
          packageHeight: data.packageHeight?.trim() || undefined,
          packageLength: data.packageLength?.trim() || undefined,
          packageWidth: data.packageWidth?.trim() || undefined,
          netContent: data.netContent?.trim() || undefined,
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Required Fields */}
      <Card title="필수 항목">
        <div className="space-y-4">
          {/* Product Name */}
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              상품명
            </label>
            <Input
              id="productName"
              type="text"
              placeholder="상품명을 입력해주세요"
              disabled={isLoading}
              {...register('productName')}
            />
            {errors.productName && <p className="text-red-600 text-sm mt-1">{errors.productName.message}</p>}
          </div>
        </div>
      </Card>

      {/* Optional Fields */}
      <Card title="선택 항목">
        <div className="space-y-4">
          {/* Barcode ID */}
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              바코드 ID
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="barcodeId"
                  type="text"
                  placeholder="바코드 ID를 입력해주세요 (선택)"
                  {...register('barcodeId')}
                  disabled={validatedBarcode !== null}
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
              <Input
                id="brand"
                type="text"
                placeholder="브랜드명을 입력해주세요"
                disabled={isLoading}
                {...register('brand')}
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-900 mb-1">
                가격
              </label>
              <Input
                id="price"
                type="text"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]+)?"
                placeholder="0"
                disabled={isLoading}
                {...register('price')}
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
              <label htmlFor="netContentUnit" className="block text-sm font-medium text-gray-900 mb-1">
                단위
              </label>
              {/* 내용물 양을 적었으면 단위를 함께 골라야 한다(서버가 400 으로 거절한다).
                  ⚠️ 반대(단위만 고르고 양은 빈칸)는 서버가 막지 않으므로 여기서도 막지 않는다. */}
              <select
                id="netContentUnit"
                disabled={isLoading}
                {...register('netContentUnit', {
                  validate: (value, values) =>
                    (values.netContent ?? '').trim() !== '' && !(value ?? '').trim()
                      ? '내용물 양을 입력하면 단위를 함께 선택해주세요'
                      : true,
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">단위 선택</option>
                <option value="G">g</option>
                <option value="KG">kg</option>
                <option value="L">l</option>
                <option value="ML">ml</option>
              </select>
              {errors.netContentUnit && (
                <p className="text-red-600 text-sm mt-1">{errors.netContentUnit.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="packageHeight" className="block text-sm font-medium text-gray-900 mb-1">
                높이
              </label>
              <Input
                id="packageHeight"
                type="text"
                placeholder="예: 160mm"
                disabled={isLoading}
                {...register('packageHeight')}
              />
              {errors.packageHeight && <p className="text-red-600 text-sm mt-1">{errors.packageHeight.message}</p>}
            </div>

            <div>
              <label htmlFor="packageLength" className="block text-sm font-medium text-gray-900 mb-1">
                길이
              </label>
              <Input
                id="packageLength"
                type="text"
                placeholder="예: 75mm"
                disabled={isLoading}
                {...register('packageLength')}
              />
              {errors.packageLength && <p className="text-red-600 text-sm mt-1">{errors.packageLength.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="packageWidth" className="block text-sm font-medium text-gray-900 mb-1">
                너비
              </label>
              <Input
                id="packageWidth"
                type="text"
                placeholder="예: 8.9mm"
                disabled={isLoading}
                {...register('packageWidth')}
              />
              {errors.packageWidth && <p className="text-red-600 text-sm mt-1">{errors.packageWidth.message}</p>}
            </div>

            <div>
              <label htmlFor="netContent" className="block text-sm font-medium text-gray-900 mb-1">
                내용물 양
              </label>
              <Input
                id="netContent"
                type="text"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]+)?"
                placeholder="0"
                disabled={isLoading}
                {...register('netContent', { deps: ['netContentUnit'] })}
              />
              {errors.netContent && <p className="text-red-600 text-sm mt-1">{errors.netContent.message}</p>}
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
      </Card>

      {/* Image gallery (register mode = local buffer; uploaded after the product is created) */}
      <ProductImageGallery
        productId={null}
        useCase={imageUseCase}
        buffer={imageBuffer}
        onBufferChange={onImageBufferChange}
        urlBuffer={pickedImageUrls}
        onUrlDrop={handleUrlDrop}
        onUrlRemove={handleUrlRemove}
      />

      {/* Submit Button (sticky - 스크롤해도 하단에 고정) */}
      <div className="sticky bottom-0 -mb-6 bg-page border-t border-gray-200 p-4 -mx-6 px-6">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitDisabled}
          isLoading={isLoading}
          loadingText="등록 중..."
        >
          상품 등록
        </Button>
      </div>
    </form>
  );
}
