'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageGallery } from './ProductImageGallery';
import { ProductThumbnailSection } from './ProductThumbnailSection';
import { StockCard } from './StockCard';

interface ProductDetailViewProps {
  product: Product;
  onDelete: () => Promise<void>;
  imageUseCase: ProductImageUseCase;
}

export function ProductDetailView({ product, onDelete, imageUseCase }: ProductDetailViewProps) {
  const router = useRouter();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      router.push(ROUTES.PRODUCTS_RETRIEVE);
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  }, [onDelete, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">상품 상세</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(ROUTES.PRODUCT_EDIT(product.id))}
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

      {/* Stock Card */}
      {product.barcodeId && <StockCard barcodeId={product.barcodeId} productName={product.productName} />}

      {/* Image gallery */}
      <ProductImageGallery productId={product.id} useCase={imageUseCase} />

      {/* Per-seller generated thumbnails */}
      <ProductThumbnailSection
        productId={product.id}
        productBrand={product.brand}
        productName={product.productName}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">상품 삭제</h2>
            <p className="text-gray-600 mb-8">
              이 상품을 삭제할까요? 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
