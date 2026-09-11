'use client';

import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';

interface CarrierRateTableProps {
  carrierRates: CarrierRate[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  selectedId?: number;
  onRowClick?: (carrierRate: CarrierRate) => void;
}

export function CarrierRateTable({
  carrierRates,
  isLoading,
  error,
  hasSearched,
  selectedId,
  onRowClick,
}: CarrierRateTableProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <TableCard
      isLoading={isLoading && hasSearched}
      isEmpty={carrierRates.length === 0}
      emptyMessage={
        hasSearched ? '조회 결과가 없습니다.' : '검색 버튼을 클릭하여 택배비 정보를 조회해주세요.'
      }
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">배송사</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">타입</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">비용</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유효일</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">기본값</th>
          </tr>
        </thead>
        <tbody>
          {carrierRates.map((rate) => (
            <tr
              key={rate.id}
              onClick={() => onRowClick?.(rate)}
              className={`border-b cursor-pointer hover:bg-gray-100 ${
                selectedId === rate.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-6 py-3 text-sm text-gray-900">{rate.carrier}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{rate.type}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{rate.cost.toLocaleString()}원</td>
              <td className="px-6 py-3 text-sm text-gray-900">{rate.effectiveDate}</td>
              <td className="px-6 py-3 text-sm">
                {rate.isDefault ? (
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    기본값
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
