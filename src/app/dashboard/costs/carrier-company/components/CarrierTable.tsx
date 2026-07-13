'use client';

import type { Carrier } from '@/domain/entities/CarrierEntity';

interface CarrierTableProps {
  carriers: Carrier[];
  isLoading: boolean;
  onToggleActive: (carrier: Carrier) => void;
  onEdit: (carrier: Carrier) => void;
  onDelete: (carrier: Carrier) => void;
}

export function CarrierTable({
  carriers,
  isLoading,
  onToggleActive,
  onEdit,
  onDelete,
}: CarrierTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow list-table-scroll">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">택배사명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">활성</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">관리</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-200">
                {[...Array(3)].map((_, j) => (
                  <td key={j} className="px-6 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (carriers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        등록된 택배사가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">택배사명</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">활성</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {carriers.map((carrier) => (
            <tr key={carrier.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-700">{carrier.name}</td>
              <td className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => onToggleActive(carrier)}
                  aria-label={carrier.isActive ? '비활성화' : '활성화'}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    carrier.isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {carrier.isActive ? '활성' : '비활성'}
                </button>
              </td>
              <td className="px-6 py-3 text-right space-x-2">
                <button
                  type="button"
                  onClick={() => onEdit(carrier)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(carrier)}
                  className="px-3 py-1 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
