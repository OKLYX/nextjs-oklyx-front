'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Product } from '@/domain/entities/Product';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from './ProductImageGallery';
import { Input } from '@/presentation/components/ui/Input';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { useClipboardStore } from '@/infrastructure/stores/clipboardStore';
import type { ClipValues } from '@/domain/entities/ClipItem';
import { ClipboardFillModal, CLIP_FIELD_LABELS, type ProductClip } from './ClipboardFillModal';

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
  // 저장 실패는 **폼 안에서** 끝난다 — 페이지 전체를 에러 화면으로 바꾸지 않는다(입력값이 날아간다).
  const [saveError, setSaveError] = useState<string | null>(null);

  const [clipNotice, setClipNotice] = useState('');
  const [isFillOpen, setIsFillOpen] = useState(false);
  const clipItems = useClipboardStore((state) => state.items);
  // 값을 가진 항목만 채우기 대상이다(사진 한 장짜리 항목에는 채울 값이 없다).
  // 목록 앞이 가장 최근에 담은 것 — 팝업의 기본 선택이 된다.
  const productClips = clipItems.filter((item): item is ProductClip => item.kind === 'product');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
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
  const formValues = watch();

  // 🔴 어느 물품에서·어느 항목을 채울지는 팝업이 고른다 — 여기서는 고른 것만 그대로 넣는다.
  //    체크한 항목은 이미 값이 있어도 **덮어쓴다**(일부러 고른 것). 무엇을 잃는지는 팝업이
  //    `현재 값 → 새 값` 으로 미리 보여준다.
  // 상품명·바코드는 대상이 아니다(`ClipValues` 에 아예 없다).
  const handleApplyFill = useCallback(
    (values: ClipValues, keys: (keyof ClipValues)[]) => {
      const filled: string[] = [];
      keys.forEach((key) => {
        const next = values[key];
        if (next == null || next === '') return;
        setValue(key, next, { shouldDirty: true });
        filled.push(CLIP_FIELD_LABELS[key]);
      });
      setClipNotice(
        filled.length === 0
          ? '채운 항목이 없습니다.'
          : `${filled.join('·')} ${filled.length}개 항목을 채웠습니다.`,
      );
      setIsFillOpen(false);
    },
    [setValue],
  );

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
      setSaveError(null);
      try {
        // 치수·내용물 양은 서버에서 문자열이다 → 입력한 글자를 그대로 보낸다.
        // 빈칸은 `null` 이 아니라 `''` 로 보내야 실제로 지워진다(서버의 `null` = 필드 미전송).
        const payload: UpdateProductRequest = {
          ...data,
          price: data.price ? Number(data.price) : null,
          packageHeight: data.packageHeight.trim(),
          packageLength: data.packageLength.trim(),
          packageWidth: data.packageWidth.trim(),
          netContent: data.netContent.trim(),
        };
        await onSave(payload);
      } catch (err) {
        // 인라인 배너로만 알린다. 백엔드 사유(바코드 중복 등)를 그대로 보여준다.
        setSaveError(extractErrorMessage(err, '저장에 실패했습니다. 잠시 후 다시 시도해주세요.'));
        setIsSaving(false);
      }
    },
    [onSave]
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {saveError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700 text-sm">{saveError}</p>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-600 hover:text-red-700 text-lg font-bold leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* [취소][저장] 은 폼 **오른쪽 위**다 — 상세 화면의 [수정][삭제] 와 같은 자리라 수정 모드를
          오갈 때 버튼이 움직이지 않는다. `ui/Button` 사용(취소=secondary 가 왼쪽).
          ⚠️ 폼 맨 아래로 되돌리지 말 것(2026-09-20). */}
      <div className="flex items-center justify-end gap-2">
        {clipNotice && <span className="text-sm text-gray-600">{clipNotice}</span>}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsFillOpen(true)}
          disabled={productClips.length === 0}
          title={productClips.length > 0 ? undefined : '담긴 상품 정보가 없습니다'}
        >
          클립보드에서 채우기
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          취소
        </Button>
        <Button
          type="submit"
          disabled={!!barcodeError}
          isLoading={isSaving}
          loadingText="저장 중..."
        >
          저장
        </Button>
      </div>

      <Card title="필수 항목">
        <div className="space-y-4">
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              바코드 ID
            </label>
            <Input
              id="barcodeId"
              type="text"
              placeholder="바코드 ID를 입력해주세요 (선택)"
              {...register('barcodeId')}
              onBlur={handleBarcodeBlur}
            />
            {barcodeError && <p className="text-red-600 text-sm mt-1">{barcodeError}</p>}
          </div>

          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              상품명
            </label>
            <Input
              id="productName"
              type="text"
              placeholder="상품명을 입력해주세요"
              {...register('productName')}
            />
          </div>
        </div>
      </Card>

      <Card title="선택 항목">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-900 mb-1">
                브랜드
              </label>
              <Input
                id="brand"
                type="text"
                placeholder="브랜드명을 입력해주세요"
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
                {...register('price')}
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
              {/* 내용물 양을 적었으면 단위를 함께 골라야 한다(서버가 400 으로 거절한다).
                  ⚠️ 반대(단위만 고르고 양은 빈칸)는 서버가 막지 않으므로 여기서도 막지 않는다.
                  🔴 이 물품이 원래 단위가 없었더라도 수정 화면은 빈 단위로 시작하므로,
                     양만 입력하는 경로가 여기서 걸린다. */}
              <select
                id="netContentUnit"
                {...register('netContentUnit', {
                  validate: (value, values) =>
                    values.netContent.trim() !== '' && !value.trim()
                      ? '내용물 양을 입력하면 단위를 함께 선택해주세요'
                      : true,
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {...register('packageHeight')}
              />
            </div>

            <div>
              <label htmlFor="packageLength" className="block text-sm font-medium text-gray-900 mb-1">
                길이
              </label>
              <Input
                id="packageLength"
                type="text"
                placeholder="예: 75mm"
                {...register('packageLength')}
              />
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
                {...register('packageWidth')}
              />
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
                {...register('netContent', { deps: ['netContentUnit'] })}
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
      </Card>

      <ProductImageGallery
        productId={product.id}
        useCase={imageUseCase}
        productName={product.productName}
      />

      {/* ⚠️ 열려 있을 때만 렌더한다 — 닫을 때마다 물품/항목 선택이 초기화되어야 한다. */}
      {isFillOpen && (
        <ClipboardFillModal
          clips={productClips}
          currentValues={formValues}
          onApply={handleApplyFill}
          onClose={() => setIsFillOpen(false)}
        />
      )}
    </form>
  );
}