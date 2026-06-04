'use client';

import type { ProductListingOption } from '@/domain/entities/ProductListingEntity';

interface ProductListingDetailsTableProps {
  options?: ProductListingOption[];
  isLoading: boolean;
}

export function ProductListingDetailsTable({ options = [], isLoading }: ProductListingDetailsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📋 옵션 및 구성상품</h2>
        </div>
        <div className="px-6 py-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!options || options.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📋 옵션 및 구성상품</h2>
        </div>
        <div className="px-6 py-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-600 text-sm text-center">
            등록된 옵션이 없습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">📋 옵션 및 구성상품</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">옵션명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매가</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">플랫폼 옵션 ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">구성상품</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {options.map((option) => (
              <tr key={option.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{option.optionName}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {option.sellingPrice?.toLocaleString('ko-KR') || '-'}원
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{option.platformOptionId || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  {option.products && option.products.length > 0 ? (
                    <div className="space-y-1">
                      {option.products.map((product) => (
                        <div key={product.id} className="text-gray-600">
                          {product.productName} × {product.quantity}개
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
