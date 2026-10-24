'use client';

import type { ProductListingOption } from '@/domain/entities/ProductListingEntity';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

// Narrow-screen row grid (FEATURE_2610_31 D14) — the app's option rows: 「옵션명」 3 · 「판매가」 2 · 「플랫폼 옵션 ID」 3 · 「구성상품」 3.
const ROW_GRID = 'grid grid-cols-[3fr_2fr_3fr_3fr] gap-2 text-[13px]';

interface ProductListingDetailsTableProps {
  options?: ProductListingOption[];
  isLoading: boolean;
}

export function ProductListingDetailsTable({
  options = [],
  isLoading,
}: ProductListingDetailsTableProps) {
  // Narrow-screen cards (FEATURE_2610_31 D14): the app's option list — a header line, then one row per option.
  const renderCards = () => [
    <div key="header" className={`${ROW_GRID} bg-white px-3 py-2 font-semibold text-gray-900`}>
      <span>옵션명</span>
      <span className="text-right">판매가</span>
      <span>플랫폼 옵션 ID</span>
      <span>구성상품</span>
    </div>,
    ...options.map((option) => (
      <DataCard
        key={option.id}
        body={
          <div className={`${ROW_GRID} text-gray-500`}>
            <span className="break-words">{option.optionName}</span>
            <span className="text-right">{option.sellingPrice?.toLocaleString('ko-KR') || '-'}원</span>
            <span className="break-all">{option.platformOptionId || '-'}</span>
            <span>
              {option.products && option.products.length > 0
                ? option.products.map((product) => (
                    <span key={product.id} className="block">
                      {product.productName} × {product.quantity}개
                    </span>
                  ))
                : '-'}
            </span>
          </div>
        }
      />
    )),
  ];

  return (
    // 카드 머리말은 로딩·빈 상태에서도 남는다 — 상태 블록만 본문 자리에서 바뀐다.
    <TableCard renderCards={isLoading || options.length === 0 ? undefined : renderCards}>
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
