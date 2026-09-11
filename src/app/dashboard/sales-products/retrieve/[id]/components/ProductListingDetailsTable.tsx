'use client';

import type { ProductListingOption } from '@/domain/entities/ProductListingEntity';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { TableCard } from '@/presentation/components/ui/TableCard';

interface ProductListingDetailsTableProps {
  options?: ProductListingOption[];
  isLoading: boolean;
}

export function ProductListingDetailsTable({
  options = [],
  isLoading,
}: ProductListingDetailsTableProps) {
  return (
    // 카드 머리말은 로딩·빈 상태에서도 남는다 — 상태 블록만 본문 자리에서 바뀐다.
    <TableCard>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">📋 옵션 및 구성상품</h2>
      </div>

      {isLoading ? (
        <StateBlock variant="loading" message="불러오는 중..." />
      ) : options.length === 0 ? (
        <StateBlock variant="empty" message="등록된 옵션이 없습니다." />
      ) : (
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">옵션명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매가</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                플랫폼 옵션 ID
              </th>
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
                <td className="px-6 py-4 text-sm text-gray-500">
                  {option.platformOptionId || '-'}
                </td>
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
      )}
    </TableCard>
  );
}
