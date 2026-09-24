'use client';

import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 판매상품 조회 조회 조건 카드.
 *
 * 다른 목록 화면의 검색 카드(`ProductSearchCard` · `ClaimSearchCard` · `SellerSearchCard`)와 같은
 * 껍데기다 — `Card` + 라벨 붙은 입력 + 하단 "결과 수 / [검색]" 줄.
 *
 * 조회 조건은 셋이고 **모두 AND** 로 걸린다: 플랫폼(필수) · 마스터 미연결 여부 · 검색어(선택).
 *
 * ⚠️ 검색어는 **[검색] 을 눌러야(또는 Enter)** 커밋된다. 타이핑마다 조회하는 디바운스 자동 검색으로
 * 바꾸지 말 것 — 플랫폼을 고르기도 전에 요청이 나간다.
 *
 * 🔴 **Enter 판정은 `e.key` 만 보면 안 된다.** 한글 IME 로 글자를 조합하는 중에 친 Enter 는 브라우저가
 * IME 에 먼저 넘기므로 `key` 가 `'Enter'` 가 아니라 `'Process'`(keyCode 229)로 온다. `key === 'Enter'`
 * 만 검사하면 그 Enter 가 통째로 무시돼 **요청이 아예 나가지 않고 이전 결과가 그대로 남는다**
 * (`ProductSearchCard` 와 같은 사고). 물리 키(`code`)로도 Enter 를 판정한다.
 *
 * 🔴 **[검색] 버튼을 불러오는 중이라고 잠그지 말 것.** 목록을 불러오는 동안 버튼을 `disabled` 로 두면
 * 그 사이에 조건을 바꿔 누른 [검색] 이 아무 일도 없이 사라져 "재검색이 안 된다"로 보인다
 * (2026-09-24 물품 목록에서 실제로 난 사고). 로딩은 버튼 글자("검색 중...")와 표로만 알린다 —
 * 컨테이너가 마지막 요청만 화면에 반영하므로(`alive` 가드) 잠글 이유가 없다.
 */
interface ProductListingSearchCardProps {
  searchPlatform: string;
  onSearchChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  /**
   * 검색 실행. `term` 을 주면 그 문자열로 검색한다.
   * 🔴 IME 조합 중 Enter 는 조합 확정 전이라 부모의 `searchTerm` 보다 **입력창이 최신**일 수 있다 —
   * Enter 경로는 화면에 보이는 값을 그대로 넘긴다.
   */
  onSearch: (term?: string) => void;
  isLoading: boolean;
  /** 서버가 내려준 조회 결과 총 개수(현재 페이지 행 수가 아니다). */
  resultCount: number;
  unlinkedOnly: boolean;
  // 토글 즉시 page=0 재검색은 컨테이너 책임.
  onUnlinkedOnlyChange: (next: boolean) => void;
}

/** 물리 키 기준 Enter 판정. IME 가 먹은 Enter(`key === 'Process'`, keyCode 229)까지 포함한다. */
function isEnterKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  return e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
}

export function ProductListingSearchCard({
  searchPlatform,
  onSearchChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  isLoading,
  resultCount,
  unlinkedOnly,
  onUnlinkedOnlyChange,
}: ProductListingSearchCardProps) {

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼</label>
          <select
            value={searchPlatform}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">선택하세요</option>
            <option value="COUPANG">쿠팡</option>
            <option value="GMARKET">지마켓</option>
            <option value="AUCTION">옥션</option>
            <option value="SMARTSTORE">스마트스토어</option>
          </select>
        </div>

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
              placeholder="상품명 · 마켓 상품 ID"
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

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => onUnlinkedOnlyChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            마스터 미연결만
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          {/* 🔴 `onClick={onSearch}` 로 넘기면 MouseEvent 가 `term` 자리로 들어간다 — 반드시 감싼다.
              🔴 `disabled={isLoading}` 를 붙이지 말 것 — 위 주석 참고. */}
          <Button onClick={() => onSearch()}>
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
