'use client';

import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

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

  // Narrow-screen cards (FEATURE_2610_31 D14 · D23 · D37): the app's commission-rate row — platform, category
  // (「기본값」 when there is none), rate in % at the right end; the table's ID at the bottom. The app's 「기본값」 chip
  // is left out (the web rate has no default flag).
  const renderCards = () =>
    commissionRates.map((rate) => (
      <DataCard
        key={rate.id}
        onClick={() => onRowClick(rate)}
        selected={selectedId === rate.id}
        title={<span className="text-base font-normal">{rate.platform}</span>}
        trailing={<span className="text-[11px] font-medium text-gray-500">{(rate.rate * 100).toFixed(2)}%</span>}
        body={
          <p className="text-sm text-gray-500">
            {rate.categoryId === null ? '기본값' : getCategoryName(rate.categoryId)}
          </p>
        }
        extraFields={[{ label: 'ID', value: rate.id }]}
      />
    ));

  return (
    <TableCard
      renderCards={renderCards}
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
