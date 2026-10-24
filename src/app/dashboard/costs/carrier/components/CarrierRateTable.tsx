'use client';

import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

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

  // Narrow-screen cards (FEATURE_2610_31 D14): the app's carrier-rate card — carrier, 「기본값」 badge at the right end,
  // then 「비용」 · 「유형」 · 「가격 적용」 lines. A tap calls `onRowClick` like a row tap.
  const renderCards = () =>
    carrierRates.map((rate) => (
      <DataCard
        key={rate.id}
        onClick={() => onRowClick?.(rate)}
        selected={selectedId === rate.id}
        title={rate.carrier}
        trailing={
          rate.isDefault ? (
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-gray-900">기본값</span>
          ) : undefined
        }
        body={
          <div className="space-y-1 text-sm text-gray-900">
            <p>비용: {rate.cost.toLocaleString()}원</p>
            <p>유형: {rate.type}</p>
            <p>가격 적용: {rate.effectiveDate}</p>
          </div>
        }
      />
    ));

  return (
    <TableCard
      renderCards={renderCards}
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
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">가격 적용</th>
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
