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
        <div className="flex gap-2">
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
      <ProductImageGallery productId={product.id} useCase={imageUseCase} />

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
