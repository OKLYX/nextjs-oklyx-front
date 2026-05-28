'use client';

import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { Category } from '@/domain/entities/CategoryEntity';

interface CommissionRateTableProps {
  commissionRates: CommissionRate[];
  categories: Category[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  selectedId?: number;
  onRowClick: (rate: CommissionRate) => void;
}

export function CommissionRateTable({
  commissionRates,
  categories,
  isLoading,
  error,
  hasSearched,
  selectedId,
  onRowClick,
}: CommissionRateTableProps) {
  const getCategoryName = (categoryId: number | null): string => {
    if (categoryId === null) return '-';
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : `ID: ${categoryId}`;
  };
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (isLoading && hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">플랫폼</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">카테고리</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">수수료율</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-8" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!commissionRates.length && hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600 text-lg">조회 결과가 없습니다.</p>
      </div>
    );
  }

  if (!hasSearched) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">플랫폼</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">카테고리</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">수수료율</th>
          </tr>
        </thead>
        <tbody>
          {commissionRates.map((rate) => (
            <tr
              key={rate.id}
              onClick={() => onRowClick(rate)}
              className={`border-b cursor-pointer hover:bg-gray-100 ${
                selectedId === rate.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-6 py-3 text-sm text-gray-900">{rate.id}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{rate.platform}</td>
              <td className="px-6 py-3 text-sm text-gray-900">
                {getCategoryName(rate.categoryId)}
              </td>
              <td className="px-6 py-3 text-sm text-gray-900">{rate.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
