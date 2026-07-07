'use client';

import { useSyncExternalStore } from 'react';
import { useListViewStore, type ListViewMode } from '@/infrastructure/stores/listViewStore';

/**
 * 좁은 화면(md 미만)에서 리스트를 표/카드로 전환하는 세그먼트 토글 버튼.
 *
 * **용도**: 카드 뷰를 가진 리스트 테이블 상단에 배치. 사용자가 표(가로 스크롤)와
 *   카드 보기를 직접 전환. 선택값은 [[listViewStore]]에 영속되어 화면 간 유지된다.
 * **파일**: src/presentation/components/ViewModeToggle.tsx
 *
 * **표시 조건**: `md:hidden` — 좁은 화면에서만 노출(데스크탑은 항상 표라 불필요).
 *   하이드레이션 불일치 방지를 위해 마운트 전에는 렌더하지 않음(TopBar 패턴과 동일).
 *
 * **사용 예제** (카드 뷰가 있는 테이블에서):
 *   const viewMode = useListViewStore((s) => s.viewMode);
 *   const isMobile = useIsMobile();
 *   const showCards = isMobile && viewMode === 'card';
 *   // ...
 *   <div className="flex justify-end md:hidden"><ViewModeToggle /></div>
 *   <div className={showCards ? 'hidden md:block' : 'block'}>{table}</div>
 *   {showCards && <div className="md:hidden">{cards}</div>}
 *
 * ⚠️ 카드 렌더러가 없는 테이블에는 넣지 말 것(전환할 대상이 없음).
 * ❌ 금지: 색 하드코딩 — 활성색은 `bg-blue-600`(브랜드 리맵) 사용.
 */
const OPTIONS: { value: ListViewMode; label: string }[] = [
  { value: 'table', label: '표' },
  { value: 'card', label: '카드' },
];

export function ViewModeToggle({ className }: { className?: string }) {
  const viewMode = useListViewStore((state) => state.viewMode);
  const setViewMode = useListViewStore((state) => state.setViewMode);

  // Avoid hydration mismatch: the persisted value is client-only, so render
  // nothing until mounted (server/hydration = null), then the client value.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!mounted) return null;

  return (
    <div
      role="group"
      aria-label="리스트 보기 방식"
      className={`md:hidden inline-flex rounded-lg border border-gray-300 bg-white p-0.5 ${className ?? ''}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setViewMode(option.value)}
          aria-pressed={viewMode === option.value}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === option.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
