'use client';

import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';

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

  if (!hasSearched) {
    return null;
  }

  return (
    <TableCard
      isLoading={isLoading}
      isEmpty={commissionRates.length === 0}
      emptyMessage="조회 결과가 없습니다."
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
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
    </TableCard>
  );
}
