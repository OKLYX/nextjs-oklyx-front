'use client';

import { CLAIM_STATUS_LABEL, faultTypeText } from '@/domain/entities/ClaimEntity';
import type { Claim } from '@/domain/entities/ClaimEntity';

interface ClaimTableProps {
  claims: Claim[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  // Sorting is a single axis (접수일) — no sort key, only a direction.
  sortDir: 'asc' | 'desc';
  onToggleSort: () => void;
  onRowClick: (claim: Claim) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** The container decides the wording — "no data" and "filtered out" mean different things. */
  emptyMessage: string;
}

// Headers are a static list: 사유 and 귀책 are derived values, not one field of Claim,
// so a `keyof Claim` column array (like OrderTable's) cannot describe them.
const HEADERS: { label: string; align: 'left' | 'right'; sortable?: boolean }[] = [
  { label: '접수일', align: 'left', sortable: true },
  { label: '주문번호', align: 'left' },
  { label: '상품', align: 'left' },
  { label: '수량', align: 'right' },
  { label: '사유', align: 'left' },
  { label: '귀책', align: 'left' },
  { label: '상태', align: 'left' },
  { label: '회수송장', align: 'left' },
];

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

export function ClaimTable({
  claims,
  isLoading,
  error,
  hasSearched,
  sortDir,
  onToggleSort,
  onRowClick,
  currentPage,
  totalPages,
  onPageChange,
  emptyMessage,
}: ClaimTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                {HEADERS.map((col) => (
                  <th key={col.label} className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  {[...Array(HEADERS.length)].map((_, j) => (
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
        조회 결과가 여기에 표시됩니다.
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="list-table-scroll">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {HEADERS.map((col) => (
                <th
                  key={col.label}
                  onClick={col.sortable ? onToggleSort : undefined}
                  className={`px-6 py-3 text-sm font-semibold text-gray-900 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-200 transition-colors' : ''}`}
                >
                  {col.label}
                  {col.sortable && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {claims.map((claim) => (
              <tr
                key={claim.id}
                onClick={() => onRowClick(claim)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-6 py-3 text-sm text-gray-700">{formatDate(claim.receivedAt)}</td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  {claim.externalOrderId}
                  {!claim.linked && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      주문 미연결
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{claim.itemName ?? '-'}</td>
                <td className="px-6 py-3 text-sm text-right text-gray-700">{claim.quantity}</td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  {claim.reasonText ?? claim.reasonCode ?? '-'}
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{faultTypeText(claim.faultType)}</td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{claim.collectInvoiceNo ?? '-'}</td>
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
