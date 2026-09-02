'use client';

import { useState, useEffect } from 'react';
import { PAGE_SIZES, SORT_OPTIONS, type MasterListQuery } from '../masterListQuery';

interface MasterProductToolbarProps {
  query: MasterListQuery;
  onChange: (patch: Partial<MasterListQuery>) => void;
}

/**
 * 판매상품 마스터 목록의 조회 조건 툴바 (이름 검색 · 페이지 크기 · 정렬).
 * File: src/app/dashboard/master-products/components/MasterProductToolbar.tsx
 *
 * ⚠️ 컨트롤은 상태를 갖지 않는다 — 값은 `query`(URL 파생)에서 오고 변경은 `onChange` 로 위임한다.
 * 예외는 타이핑 중인 검색어(draft) 하나뿐이며, 300ms 디바운스 후 `onChange` 로 반영한다.
 *
 * ⚠️ draft ↔ URL 은 단방향이다: 마운트 시 URL 의 `q` 만 읽고, 이후 URL 변경으로 draft 를 덮지 않는다
 * (덮으면 디바운스 중 타이핑이 튄다). 뒤로가기로 `q` 가 바뀌면 목록은 갱신되지만 입력창에는 이전
 * 문자열이 남는 것을 허용한다 — 고치려고 URL→draft 역동기화 useEffect 를 넣지 말 것.
 *
 * ⚠️ `onChange` 는 부모에서 `useCallback` 으로 고정할 것(부모 리렌더마다 디바운스 타이머가 리셋된다).
 *
 * ❌ 옵션을 JSX 에 하드코딩하지 말 것 — PAGE_SIZES / SORT_OPTIONS 를 map 한다.
 */
export function MasterProductToolbar({ query, onChange }: MasterProductToolbarProps) {
  const [draft, setDraft] = useState(() => query.q ?? '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = draft.trim();
      onChange({ q: next ? next : undefined });
    }, 300);

    return () => clearTimeout(timer);
  }, [draft, onChange]);

  const handleReset = () => {
    setDraft('');
    onChange({ q: undefined });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2 sm:max-w-md sm:flex-1">
        <input
          type="text"
          placeholder="이름 검색..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
        >
          초기화
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={query.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="페이지당 개수"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}개씩
            </option>
          ))}
        </select>

        <select
          value={query.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="정렬"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
