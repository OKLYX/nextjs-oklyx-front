'use client';

import type { Seller } from '@/domain/entities/SellerEntity';
import { Card } from '@/presentation/components/ui/Card';

interface StockSearchFormProps {
  keyword: string;
  sellerId: string;
  sellers: Seller[];
  isLoading: boolean;
  onKeywordChange: (value: string) => void;
  onSellerChange: (value: string) => void;
  onSearch: () => void;
}

/**
 * 재고 조회 필터 (FEATURE_2609_28 / PLAN 2609_29 D5).
 *
 * ⚠️ 판매자를 비우면 전 판매자다 — 그래도 행은 (물품 × 판매자) 단위로 나온다. 합쳐서 보여주지 않는다.
 */
export function StockSearchForm({
  keyword,
  sellerId,
  sellers,
  isLoading,
  onKeywordChange,
  onSellerChange,
  onSearch,
}: StockSearchFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <Card title="재고 조회">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">상품명</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="선택사항 - 상품명 일부"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">판매자</label>
          <select
            value={sellerId}
            onChange={(e) => onSellerChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">전체</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onSearch}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '조회 중...' : '조회'}
        </button>
      </div>
    </Card>
  );
}
