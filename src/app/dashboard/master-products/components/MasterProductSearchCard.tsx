'use client';

import { X } from 'lucide-react';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { PAGE_SIZES, SORT_OPTIONS } from '../masterListQuery';

/**
 * 판매상품 마스터 목록의 조회 조건 카드.
 * File: src/app/dashboard/master-products/components/MasterProductSearchCard.tsx
 *
 * 다른 목록 화면의 검색 카드(`ProductSearchCard` · `SellerSearchCard` · `ProductListingSearchCard`)와
 * 같은 껍데기다 — `Card` + 라벨 붙은 입력 + 하단 "결과 수 / [검색]" 줄.
 *
 * ⚠️ 검색어는 **[검색] 을 눌러야(또는 Enter)** 커밋된다. 예전 300ms 디바운스 자동 검색으로
 * 되돌리지 말 것 — 조회 조건의 단일 진실원은 URL 이라(`../masterListQuery`) 타이핑마다
 * `router.replace` 가 돌면 페이지 이동과 경쟁한다(`ProductSearchCard` 가 2026-09-19 에 고친 버그).
 *
 * ⚠️ 페이지 크기·정렬은 **고르는 즉시** 커밋된다(검색어와 달리 오타가 없는 값이다).
 *
 * ❌ 옵션을 JSX 에 하드코딩하지 말 것 — PAGE_SIZES / SORT_OPTIONS 를 map 한다.
 * ❌ 흰 표면(`bg-white rounded-lg shadow`)을 직접 작성하지 말 것 — `ui/Card` 가 배경·모서리·
 *    그림자·여백을 소유한다.
 */
interface MasterProductSearchCardProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  size: number;
  onSizeChange: (value: number) => void;
  sort: string;
  onSortChange: (value: string) => void;
  isLoading: boolean;
  resultCount: number;
}

export function MasterProductSearchCard({
  searchTerm,
  onSearchTermChange,
  onSearch,
  size,
  onSizeChange,
  sort,
  onSortChange,
  isLoading,
  resultCount,
}: MasterProductSearchCardProps) {
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
              placeholder="이름 · 상품ID · 옵션ID"
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

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-2">페이지당 개수</label>
            <select
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}개씩
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-56">
            <label className="block text-sm font-medium text-gray-700 mb-2">정렬</label>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && <p className="text-sm text-gray-600">{resultCount}개의 결과</p>}
          </div>
          <Button onClick={onSearch} disabled={isLoading}>
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
