'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/domain/entities/Product';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from './ProductImageGallery';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { formatKrw } from '@/infrastructure/utils/money';
import { useClipboardStore, newClipId } from '@/infrastructure/stores/clipboardStore';
import type { ClipValues } from '@/domain/entities/ClipItem';

interface ProductDetailViewProps {
  product: Product;
  onDelete: () => Promise<void>;
  imageUseCase: ProductImageUseCase;
  /** [← 목록] 목적지. 목록에서 들어왔으면 그 페이지·검색어가 붙어 있다. */
  backHref: string;
  /** [수정] 목적지. 목록 조회 조건을 그대로 달고 간다. */
  editHref: string;
}

export function ProductDetailView({
  product,
  onDelete,
  imageUseCase,
  backHref,
  editHref,
}: ProductDetailViewProps) {
  const router = useRouter();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [clipNotice, setClipNotice] = useState('');
  const addClip = useClipboardStore((state) => state.add);

  // 클립보드에 이 물품을 통째로 담는다 — 값은 스냅샷(문자열), 사진은 참조(productImageId).
  // 🔴 상품명·바코드는 값으로 담지 않는다(바코드는 물품을 구분하는 값이라 복제하면 중복이 생긴다).
  const handlePickProduct = useCallback(async () => {
    setIsPicking(true);
    setClipNotice('');
    try {
      const images = await imageUseCase.list(product.id);
      const values: ClipValues = {};
      // 🔴 폼(RHF)이 전부 string 이라 담을 때부터 문자열로 맞춘다. 빈 값은 담지 않는다.
      const put = (key: keyof ClipValues, value: string | number | null | undefined) => {
        const text = value == null ? '' : String(value).trim();
        if (text !== '') values[key] = text;
      };
      put('brand', product.brand);
      put('store', product.store);
      put('price', product.price);
      put('netContent', product.netContent);
      put('netContentUnit', product.netContentUnit);
      put('packageWidth', product.packageWidth);
      put('packageLength', product.packageLength);
      put('packageHeight', product.packageHeight);
      put('description', product.description);
      addClip({
        clipId: newClipId(),
        kind: 'product',
        pickedAt: new Date().toISOString(),
        productId: product.id,
        productName: product.productName,
        values,
        imageRefs: [...images]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((img) => ({ productImageId: img.id, imageUrl: img.imageUrl })),
      });
      setClipNotice('클립보드에 담았습니다.');
    } catch {
      setClipNotice('클립보드에 담지 못했습니다.');
    } finally {
      setIsPicking(false);
    }
  }, [addClip, imageUseCase, product]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      router.push(backHref);
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  }, [onDelete, router, backHref]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
          ← 목록
        </Button>
        <div className="flex items-center gap-2">
          {clipNotice && <span className="text-sm text-gray-600">{clipNotice}</span>}
          <Button variant="secondary" onClick={handlePickProduct} disabled={isPicking}>
            클립보드에 담기
          </Button>
          <Button onClick={() => router.push(editHref)}>수정</Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirmation(true)}>
            삭제
          </Button>
        </div>
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">상품명</p>
              <p className="text-lg font-semibold text-gray-900">{product.productName}</p>
            </div>
            {product.barcodeId && (
              <div>
                <p className="text-sm text-gray-600">바코드 ID</p>
                <p className="text-lg font-semibold text-gray-900">{product.barcodeId}</p>
              </div>
            )}
            {product.brand && (
              <div>
                <p className="text-sm text-gray-600">브랜드</p>
                <p className="text-lg font-semibold text-gray-900">{product.brand}</p>
              </div>
            )}
            {product.price && (
              <div>
                <p className="text-sm text-gray-600">가격</p>
                <p className="text-lg font-semibold text-gray-900">{formatKrw(product.price)}</p>
              </div>
            )}
            {product.store && (
              <div>
                <p className="text-sm text-gray-600">구매처</p>
                <p className="text-lg font-semibold text-gray-900">{product.store}</p>
              </div>
            )}
            {product.netContentUnit && (
              <div>
                <p className="text-sm text-gray-600">단위</p>
                <p className="text-lg font-semibold text-gray-900">{product.netContentUnit}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            {product.packageHeight && (
              <div>
                <p className="text-sm text-gray-600">높이</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageHeight}</p>
              </div>
            )}
            {product.packageLength && (
              <div>
                <p className="text-sm text-gray-600">길이</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageLength}</p>
              </div>
            )}
            {product.packageWidth && (
              <div>
                <p className="text-sm text-gray-600">너비</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageWidth}</p>
              </div>
            )}
            {product.netContent && (
              <div>
                <p className="text-sm text-gray-600">내용물 양</p>
                <p className="text-lg font-semibold text-gray-900">{product.netContent}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Description */}
      {product.description && (
        <Card title="설명">
          <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
        </Card>
      )}

      {/* Image gallery */}
      <ProductImageGallery
        productId={product.id}
        useCase={imageUseCase}
        productName={product.productName}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirmation}
        title="상품 삭제"
        message="이 상품을 삭제할까요? 되돌릴 수 없습니다."
        confirmText="삭제"
        isDangerous
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirmation(false)}
      />
    </div>
  );
}
