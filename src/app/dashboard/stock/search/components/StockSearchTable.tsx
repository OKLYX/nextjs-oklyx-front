'use client';

import type { StockLog } from '@/domain/repositories/StockRepository';

interface StockSearchTableProps {
  logs: StockLog[];
  currentPage: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export function StockSearchTable({
  logs,
  currentPage,
  totalElements,
  onPageChange,
  isLoading,
}: StockSearchTableProps) {
  const totalPages = Math.ceil(totalElements / 20);

  const getPaginationPages = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const paginationPages = getPaginationPages();

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">바코드</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품명</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">입고</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">출고</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">재고</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  조회 결과가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.stockId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-700">{log.barcodeId}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{log.productName}</td>
                  <td className="px-6 py-3 text-center text-sm">
                    {log.stockAdd > 0 && <span className="text-green-600 font-semibold">{log.stockAdd}</span>}
                    {log.stockAdd === 0 && <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    {log.stockSub > 0 && <span className="text-red-600 font-semibold">{log.stockSub}</span>}
                    {log.stockSub === 0 && <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                    {log.inStock}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.createdDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalElements > 20 && (
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0 || isLoading}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ← 이전
          </button>

          {currentPage > 0 && (
            <button
              onClick={() => onPageChange(0)}
              className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              1
            </button>
          )}

          {paginationPages[0] > 1 && (
            <span className="px-2 py-1 text-gray-400">...</span>
          )}

          {paginationPages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={isLoading}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed'
              }`}
            >
              {page + 1}
            </button>
          ))}

          {paginationPages[paginationPages.length - 1] < totalPages - 2 && (
            <span className="px-2 py-1 text-gray-400">...</span>
          )}

          {currentPage < totalPages - 1 && (
            <button
              onClick={() => onPageChange(totalPages - 1)}
              className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              {totalPages}
            </button>
          )}

          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1 || isLoading}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
