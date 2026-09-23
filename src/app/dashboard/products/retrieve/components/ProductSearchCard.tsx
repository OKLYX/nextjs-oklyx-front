'use client';

import type { KeyboardEvent } from 'react';
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
 *
 * 🔴 **Enter 판정은 `e.key` 만 보면 안 된다.** 한글 IME 로 글자를 조합하는 중에 친 Enter 는
 * 브라우저가 IME 에 먼저 넘기므로 `key` 가 `'Enter'` 가 아니라 `'Process'`(keyCode 229)로 온다.
 * `key === 'Enter'` 만 검사하면 그 Enter 가 통째로 무시돼 **요청이 아예 나가지 않고 이전 검색
 * 결과가 그대로 남는다** — 검색어를 바꿔 Enter 를 친 사용자에게는 "검색이 작동하지 않는다"로
 * 보인다(2026-09-24 사용자 보고, 운영에서 재현). 물리 키(`code`)로도 Enter 를 판정한다.
 */
interface ProductSearchCardProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  /**
   * 검색 실행. `term` 을 주면 그 문자열로 검색한다.
   * 🔴 IME 조합 중 Enter 는 조합 확정 전이라 부모의 `searchTerm` 보다 **입력창이 최신**일 수 있다 —
   * Enter 경로는 화면에 보이는 값을 그대로 넘긴다.
   */
  onSearch: (term?: string) => void;
  isLoading: boolean;
  resultCount: number;
}

/** 물리 키 기준 Enter 판정. IME 가 먹은 Enter(`key === 'Process'`, keyCode 229)까지 포함한다. */
function isEnterKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  return e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
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
                if (!isEnterKey(e)) return;
                onSearch(e.currentTarget.value);
              }}
              placeholder="상품명 · 브랜드 · 설명 · 물품ID · 바코드"
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
          {/* 🔴 `onClick={onSearch}` 로 넘기면 MouseEvent 가 `term` 자리로 들어간다 — 반드시 감싼다. */}
          <Button onClick={() => onSearch()} disabled={isLoading}>
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
