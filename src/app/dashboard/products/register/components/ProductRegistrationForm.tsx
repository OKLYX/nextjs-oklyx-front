'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from '@/app/dashboard/products/[id]/components/ProductImageGallery';
import { PurchasePlaceCheckboxes } from '@/app/dashboard/products/[id]/components/PurchasePlaceCheckboxes';
import { usePurchasePlaces } from '@/presentation/hooks/usePurchasePlaces';
import { COUNT_UNITS } from '@/domain/entities/Product';
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
  /** 구매처 id 목록 — `register` 하지 않고 `watch`/`setValue` 로만 다룬다(체크 목록, FEATURE_2609_76). */
  purchasePlaceIds: number[];
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  countQuantity?: string;
  countUnit?: string;
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
  /**
   * 판매 상품 관리 마스터의 왼쪽 물품 패널 안에 넣을 때 `true`(2609_78 / UX D62).
   * 제출 줄을 페이지 바닥 고정(sticky · 음수 여백) 대신 폼 끝에 두고, 부피 그림을 세로로 쌓는다.
   */
  embedded?: boolean;
  /**
   * 작성 흔적(react-hook-form `isDirty`)이 바뀔 때마다 알린다(2609_78 — 패널 [새 물품 등록] 의 [취소] 확인용).
   * 도구 패널 [채우기]·구매처 체크(`setValue(…, { shouldDirty: true })`)도 포함된다.
   */
  onDirtyChange?: (dirty: boolean) => void;
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
  embedded = false,
  onDirtyChange,
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
    formState: { errors, isDirty },
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
      purchasePlaceIds: [],
      netContentUnit: '',
      packageHeight: '',
      packageLength: '',
      packageWidth: '',
      netContent: '',
      countQuantity: '',
      countUnit: '',
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

  // 2609_78: 작성 흔적을 부모(패널 [새 물품 등록])에 알린다 — [채우기]처럼 DOM 입력 없이 들어온 값도 잡힌다.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const barcodeValue = watch('barcodeId');
  const purchasePlaceIds = watch('purchasePlaceIds');
  const { places, loading: placesLoading, failed: placesFailed } = usePurchasePlaces();

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
          // 개수는 둘 다 있거나 둘 다 없다(검증은 아래 두 칸의 validate). 빈칸은 보내지 않는다.
          countQuantity: data.countQuantity?.trim() ? Number(data.countQuantity.trim()) : undefined,
          countUnit: data.countUnit || undefined,
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

          <div>
            <PurchasePlaceCheckboxes
              places={places}
              loading={placesLoading}
              failed={placesFailed}
              disabled={isLoading}
              value={purchasePlaceIds}
              onChange={(ids) => setValue('purchasePlaceIds', ids, { shouldDirty: true })}
            />
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">중량 / 수량</h3>
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label htmlFor="netContentUnit" className="block text-sm font-medium text-gray-900 mb-1">
                단위
              </label>
              {/* 내용물 양과 단위는 함께 넣거나 둘 다 비운다(서버가 400 으로 거절한다, FEATURE_2609_76 / D18). */}
              <select
                id="netContentUnit"
                disabled={isLoading}
                {...register('netContentUnit', {
                  validate: (value, values) => {
                    const hasContent = (values.netContent ?? '').trim() !== '';
                    const hasUnit = (value ?? '').trim() !== '';
                    if (hasContent && !hasUnit) return '내용물 양을 입력하면 단위를 함께 선택해주세요';
                    if (!hasContent && hasUnit) return '단위를 고르면 내용물 양을 함께 입력해주세요';
                    return true;
                  },
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
              <label htmlFor="countQuantity" className="block text-sm font-medium text-gray-900 mb-1">
                개수
              </label>
              <Input
                id="countQuantity"
                type="text"
                inputMode="numeric"
                placeholder="0"
                disabled={isLoading}
                error={errors.countQuantity?.message}
                {...register('countQuantity', {
                  deps: ['countUnit'],
                  validate: (value) =>
                    (value ?? '').trim() === '' || /^[1-9][0-9]*$/.test((value ?? '').trim())
                      ? true
                      : '개수는 1 이상의 정수로 입력해주세요',
                })}
              />
            </div>

            <div>
              <label htmlFor="countUnit" className="block text-sm font-medium text-gray-900 mb-1">
                개수 단위
              </label>
              {/* 개수와 개수 단위는 함께 넣거나 둘 다 비운다(D6). 무게·부피 단위와 섞지 않는다(D7). */}
              <select
                id="countUnit"
                disabled={isLoading}
                {...register('countUnit', {
                  validate: (value, values) => {
                    const hasQuantity = (values.countQuantity ?? '').trim() !== '';
                    const hasUnit = (value ?? '') !== '';
                    if (hasQuantity && !hasUnit) return '개수를 입력하면 개수 단위를 함께 선택해주세요';
                    if (!hasQuantity && hasUnit) return '개수 단위를 고르면 개수를 함께 입력해주세요';
                    return true;
                  },
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">개수 단위 선택</option>
                {COUNT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              {errors.countUnit && <p className="text-red-600 text-sm mt-1">{errors.countUnit.message}</p>}
            </div>
          </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">부피</h3>
            <div className={embedded ? 'flex flex-col gap-6' : 'flex flex-col sm:flex-row gap-6'}>
              <VolumeDiagram embedded={embedded} />
              <div className="flex-1 space-y-4">
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
                  <label htmlFor="packageLength" className="block text-sm font-medium text-gray-900 mb-1">
                    깊이
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
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4">
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

      {/* Submit Button (페이지 = sticky 하단 고정 · 패널 안(embedded) = 폼 끝) */}
      <div
        className={
          embedded
            ? 'border-t border-gray-200 pt-4'
            : 'sticky bottom-0 -mb-6 bg-page border-t border-gray-200 p-4 -mx-6 px-6'
        }
      >
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

/**
 * 부피 입력칸 옆 안내 그림 — 너비·깊이·높이가 상자의 어느 변인지 보여준다(등록 화면 전용).
 * 정면(흰 면) 기준: 너비 = 정면 가로, 높이 = 정면 세로, 깊이 = 앞에서 뒤로 들어가는 변.
 * 색은 Tailwind 유틸(fill/stroke/text)로만 준다 — hex 하드코딩 금지(다크모드·브랜드 리맵 규칙).
 */
function VolumeDiagram({ embedded }: { embedded: boolean }) {
  return (
    <div
      className={`shrink-0 ${embedded ? 'w-full' : 'sm:w-72'} rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col items-center justify-center`}
    >
      <svg viewBox="0 0 220 160" className="w-full max-w-[240px]" role="img" aria-label="너비·깊이·높이 안내 그림">
        <defs>
          <marker id="volArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-blue-600" />
          </marker>
        </defs>
        {/* box: top and right faces tinted, front face white */}
        <path d="M60 40 L90 16 L150 16 L120 40 Z" className="fill-amber-100 stroke-gray-500" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M120 40 L150 16 L150 88 L120 112 Z" className="fill-amber-200 stroke-gray-500" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="60" y="40" width="60" height="72" className="fill-white stroke-gray-500" strokeWidth="1.5" />
        {/* dimension arrows */}
        <g className="stroke-blue-600" strokeWidth="1.5" markerStart="url(#volArrow)" markerEnd="url(#volArrow)">
          <line x1="42" y1="42" x2="42" y2="110" />
          <line x1="62" y1="128" x2="118" y2="128" />
          <line x1="128" y1="118" x2="154" y2="97" />
        </g>
        <g className="fill-blue-600" fontSize="13" fontWeight="600" textAnchor="middle">
          <text x="24" y="80">높이</text>
          <text x="90" y="148">너비</text>
          <text x="176" y="118">깊이</text>
        </g>
      </svg>
      <p className="mt-2 text-xs text-gray-500">상품 정면 기준으로 측정</p>
    </div>
  );
}
