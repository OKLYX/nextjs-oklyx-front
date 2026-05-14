'use client';

import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';

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

  if (isLoading && hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">배송사</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">타입</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">비용</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유효일</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">기본값</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                </td>
                <td className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!carrierRates.length && hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600 text-lg">조회 결과가 없습니다.</p>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600 text-lg">검색 버튼을 클릭하여 택배비 정보를 조회해주세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
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
    </div>
  );
}
