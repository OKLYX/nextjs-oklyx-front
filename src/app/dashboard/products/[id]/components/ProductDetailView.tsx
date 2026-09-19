'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/domain/entities/Product';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from './ProductImageGallery';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

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
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          ← 목록
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(editHref)}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            수정
          </button>
          <button
            onClick={() => setShowDeleteConfirmation(true)}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
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
                <p className="text-lg font-semibold text-gray-900">${product.price}</p>
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
        </div>

        <div className="border border-gray-200 rounded-lg p-6 bg-white">
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
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">설명</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
        </div>
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
