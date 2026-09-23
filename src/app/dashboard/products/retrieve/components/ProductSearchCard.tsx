'use client';

import { X } from 'lucide-react';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 상품 목록(상품조회) 조회 조건 카드.
 *
 * 다른 목록 화면의 검색 카드(`ClaimSearchCard` · `SellerSearchCard` · `ProductListingSearchCard`)와
 * 같은 껍데기다 — `Card` + 라벨 붙은 입력 + 하단 "결과 수 / [검색]" 줄.
 *
 * ⚠️ 검색어는 **[검색] 을 눌러야(또는 Enter)** 커밋된다. 예전 300ms 디바운스 자동 검색으로
 * 되돌리지 말 것 — 조회 조건의 단일 진실원은 URL 이라(`../productListQuery`) 타이핑마다
 * `router.replace` 가 돌면 페이지 이동과 경쟁한다(2026-09-19 버그).
 */
interface ProductSearchCardProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
}

export function ProductSearchCard({
  searchTerm,
  onSearchTermChange,
  onSearch,
  isLoading,
  resultCount,
}: ProductSearchCardProps) {
  return (
    <Card>
      <div className="space-y-4">
        {/* No <form>: Enter would reload the page. Enter is handled on the input itself. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch();
              }}
              placeholder="상품명 · 브랜드 · 설명 · 물품ID"
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchTermChange('')}
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <Button onClick={onSearch} disabled={isLoading}>
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
