'use client';

import type { OrderItem } from '@/domain/entities/OrderEntity';

interface OrderTableProps {
  orders: OrderItem[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  sortKey: keyof OrderItem | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: keyof OrderItem) => void;
  onRowClick: (order: OrderItem) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface Column {
  key: keyof OrderItem;
  label: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'externalOrderId', label: '주문번호', align: 'left' },
  { key: 'itemName', label: '상품명', align: 'left' },
  { key: 'orderCount', label: '주문수량', align: 'right' },
  { key: 'cancelCount', label: '취소', align: 'right' },
  { key: 'paidAt', label: '결제일', align: 'left' },
];

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function alignClass(align: Column['align']): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function OrderTable({
  orders,
  isLoading,
  error,
  hasSearched,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  currentPage,
  totalPages,
  onPageChange,
}: OrderTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  {[...Array(COLUMNS.length)].map((_, j) => (
                    <td key={j} className="px-6 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        조회를 수행해주세요.
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        조회 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={`px-6 py-3 text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-200 transition-colors ${alignClass(col.align)}`}
                >
                  {col.label}
                  {sortKey === col.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => onRowClick(order)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-6 py-3 text-sm text-gray-700">{order.externalOrderId}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{order.itemName || '-'}</td>
                <td className="px-6 py-3 text-sm text-right text-gray-700">{order.orderCount}</td>
                <td className="px-6 py-3 text-sm text-right text-gray-700">{order.cancelCount}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{formatDate(order.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-gray-200">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ← 이전
          </button>
          <span className="text-sm text-gray-600">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
