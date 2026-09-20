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
import { useClipboardStore } from '@/infrastructure/stores/clipboardStore';
import type { ClipValues } from '@/domain/entities/ClipItem';

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

  const [clipNotice, setClipNotice] = useState('');
  const clipItems = useClipboardStore((state) => state.items);
  // 여러 개면 가장 최근(목록 앞)에 담은 물품으로 채운다.
  const latestProductClip = clipItems.find((item) => item.kind === 'product');

  const {
    register,
    handleSubmit,
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

  // 🔴 빈 칸만 채운다 — 이미 값이 있는 필드는 건드리지 않는다(PLAN D1).
  // 상품명·바코드는 대상이 아니다(`ClipValues` 에 아예 없다).
  const handleFillFromClipboard = useCallback(() => {
    if (!latestProductClip || latestProductClip.kind !== 'product') return;
    const values = latestProductClip.values;
    const filled: string[] = [];
    const LABELS: Record<keyof ClipValues, string> = {
      brand: '브랜드',
      store: '구매처',
      price: '가격',
      netContent: '내용물 양',
      netContentUnit: '단위',
      packageWidth: '너비',
      packageLength: '길이',
      packageHeight: '높이',
      description: '설명',
    };
    (Object.keys(LABELS) as (keyof ClipValues)[]).forEach((key) => {
      const next = values[key];
      if (next == null || next === '') return;
      if ((formValues[key] ?? '') !== '') return;
      setValue(key, next, { shouldDirty: true });
      filled.push(LABELS[key]);
    });
    setClipNotice(
      filled.length === 0
        ? '채울 빈 칸이 없습니다.'
        : `${filled.join('·')} 등 ${filled.length}개 항목을 채웠습니다.`,
    );
  }, [latestProductClip, formValues, setValue]);

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
      } catch {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* [취소][저장] 은 폼 **오른쪽 위**다 — 상세 화면의 [수정][삭제] 와 같은 자리라 수정 모드를
          오갈 때 버튼이 움직이지 않는다. `ui/Button` 사용(취소=secondary 가 왼쪽).
          ⚠️ 폼 맨 아래로 되돌리지 말 것(2026-09-20). */}
      <div className="flex items-center justify-end gap-2">
        {clipNotice && <span className="text-sm text-gray-600">{clipNotice}</span>}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleFillFromClipboard}
          disabled={!latestProductClip}
          title={latestProductClip ? undefined : '담긴 상품 정보가 없습니다'}
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
                {...register('netContent')}
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
    </form>
  );
}