'use client';

import type { ProductListing } from '@/domain/entities/ProductListingEntity';

interface ProductListingDetailsCardProps {
  listing: ProductListing;
  isLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductListingDetailsCard({
  listing,
  isLoading,
  onBack,
  onEdit,
  onDelete,
}: ProductListingDetailsCardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← 돌아가기
          </button>
          <h1 className="text-3xl font-bold">판매 상품 상세정보</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Product Information */}
      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">플랫폼</p>
            <p className="text-lg font-semibold text-gray-900">{listing.platform}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">상품 ID</p>
            <p className="text-lg font-semibold text-gray-900">{listing.platformProductId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">상품명</p>
            <p className="text-lg font-semibold text-gray-900">{listing.name}</p>
          </div>
        </div>
      </div>

      {/* Category & Logistics */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">카테고리</p>
              <p className="text-lg font-semibold text-gray-900">{listing.categoryName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">판매자</p>
              <p className="text-lg font-semibold text-gray-900">{listing.sellerName || '-'}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">배송사</p>
              <p className="text-lg font-semibold text-gray-900">{listing.carrierName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">패키지</p>
              <p className="text-lg font-semibold text-gray-900">{listing.packageType || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
