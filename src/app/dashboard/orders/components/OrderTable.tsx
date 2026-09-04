'use client';

import { getCustomerName } from '@/domain/entities/OrderEntity';
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
  /**
   * 선택 열을 그릴지. 미전달 = 주문내역과 완전히 같은 표(열 추가 없음).
   * 출고관리 발주처리에서만 넘긴다(PLAN 2609_17 D7).
   */
  selection?: {
    selectedIds: Set<number>;
    /** 그 행이 선택 가능한지(비대상 행은 disabled 체크박스). */
    isSelectable: (order: OrderItem) => boolean;
    onToggle: (id: number) => void;
    /** 현재 페이지의 선택 가능 행 전체 토글. */
    onTogglePage: () => void;
    /** 현재 페이지의 선택 가능 행이 모두 선택됨 = 헤더 체크박스 checked */
    isPageAllSelected: boolean;
  };
}

interface Column {
  key: keyof OrderItem;
  label: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'externalOrderId', label: '주문번호', align: 'left' },
  { key: 'receiverName', label: '고객명', align: 'left' },
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
  selection,
}: OrderTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                {/* 선택 열이 있으면 스켈레톤도 같은 열 수를 그린다 — 안 그리면 로딩 중에만 표가 흔들린다. */}
                {selection && <th className="w-10 px-3 py-3" />}
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
                  {selection && <td className="px-3 py-3" />}
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
      <div className="list-table-scroll">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {selection && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selection.isPageAllSelected}
                    disabled={!orders.some(selection.isSelectable)}
                    onChange={selection.onTogglePage}
                    aria-label="현재 페이지 전체 선택"
                    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                </th>
              )}
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
                {/* stopPropagation 은 <td> 에 건다 — 체크박스 주변 여백을 눌러도 행 클릭(상세 모달)이 새지 않게. */}
                {selection && (
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selection.selectedIds.has(order.id)}
                      disabled={!selection.isSelectable(order)}
                      onChange={() => selection.onToggle(order.id)}
                      aria-label={`${order.externalOrderId} 선택`}
                      className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                )}
                <td className="px-6 py-3 text-sm text-gray-700">{order.externalOrderId}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{getCustomerName(order)}</td>
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
