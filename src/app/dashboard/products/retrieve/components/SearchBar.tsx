'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  /** 마운트 시점의 검색어(URL 파생). 이후 URL 변경으로 입력값을 덮지 않는다. */
  initialValue?: string;
  onSearch: (keyword: string) => void;
}

/**
 * 상품 목록 검색 입력(300ms 디바운스).
 *
 * ⚠️ initialValue ↔ URL 은 단방향이다: 마운트 시 한 번만 읽는다. URL→입력값 역동기화
 * useEffect 를 넣으면 디바운스 중 타이핑이 튄다.
 *
 * ⚠️ 마지막으로 커밋한 검색어와 같으면 아예 커밋하지 않는다. 그러지 않으면 마운트 직후
 * (뒤로가기로 `?q=...&page=2` 에 돌아왔을 때) 같은 검색어를 다시 커밋하면서 부모가 이를
 * "검색 변경"으로 보아 page 를 0 으로 되돌린다.
 */
export function SearchBar({ initialValue = '', onSearch }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  // 마지막으로 URL 에 반영한 검색어 — 같은 값을 다시 커밋하지 않기 위한 기준선.
  const committedRef = useRef(initialValue.trim());

  useEffect(() => {
    const next = inputValue.trim();
    if (next === committedRef.current) return;

    const timer = setTimeout(() => {
      committedRef.current = next;
      onSearch(next);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="상품 검색..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={() => setInputValue('')}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
      >
        초기화
      </button>
    </div>
  );
}
