'use client';

import type { Seller } from '@/domain/entities/SellerEntity';
import type { StockMovement } from '@/domain/entities/StockEntity';
import { StockMovementTable } from '../../components/StockMovementTable';

interface StockInOutTableProps {
  movements: StockMovement[];
  sellers: Seller[];
  sellerId: string;
  from: string;
  to: string;
  isLoading: boolean;
  error: string;
  onSellerChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSearch: () => void;
}

/**
 * 최근 이력 (기본 30일) + 판매자·기간 필터 (FEATURE_2609_28 / PLAN 2609_29 D5).
 *
 * ⚠️ 판매자 필터는 잔량과 같은 축이다 — 재고는 판매자별로 갈리므로 이력도 그 단위로 좁힌다.
 */
export function StockInOutTable({
  movements,
  sellers,
  sellerId,
  from,
  to,
  isLoading,
  error,
  onSellerChange,
  onFromChange,
  onToChange,
  onSearch,
}: StockInOutTableProps) {
  return (
    <div className="p-6 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">최근 이력</h2>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">판매자</label>
            <select
              value={sellerId}
              onChange={(e) => onSellerChange(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">전체</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작</label>
            <input
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료</label>
            <input
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={onSearch}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      <StockMovementTable movements={movements} isLoading={isLoading} error={error} />
    </div>
  );
}
