'use client';

import type { Seller } from '@/domain/entities/SellerEntity';

interface CompletedPurchaseFilterProps {
  sellers: Seller[];
  sellerId: number | null;
  from: string;
  to: string;
  isLoading: boolean;
  onSellerChange: (sellerId: number | null) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onApply: () => void;
  onReset: () => void;
}

// Filter bar for the completed-purchase tab: seller + purchase-date range.
// Filters apply on demand (조회 button) so empty dates mean "all time".
export function CompletedPurchaseFilter({
  sellers,
  sellerId,
  from,
  to,
  isLoading,
  onSellerChange,
  onFromChange,
  onToChange,
  onApply,
  onReset,
}: CompletedPurchaseFilterProps) {
  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">판매자</label>
        <select
          value={sellerId ?? ''}
          onChange={(e) => onSellerChange(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.sellerName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">구매일 시작</label>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">구매일 종료</label>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onReset}
          disabled={isLoading}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        >
          초기화
        </button>
        <button
          onClick={onApply}
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? '조회 중...' : '조회'}
        </button>
      </div>
    </div>
  );
}
