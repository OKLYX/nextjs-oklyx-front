'use client';

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { findTool } from './toolRegistry';

/**
 * 도구 툴바가 여는 **오른쪽 고정 패널** (FEATURE_2609_68).
 *
 * **용도**: 툴바(`ToolRail`)에서 고른 도구의 본문을 그리는 작업 표면. 팝업이 아니다 —
 *   뒤 화면의 스크롤·입력을 막지 않는다.
 * **파일**: src/app/dashboard/components/ToolPanel.tsx
 * **쓰는 곳**: `dashboard/layout.tsx` **한 곳뿐**이다.
 * **본문**: `toolRegistry.tsx` 의 `Body` 를 열린 도구 키로 찾아 그린다 — 레이아웃이 넘기지 않는다
 *   (도구가 둘이 된 뒤로 레이아웃이 어느 본문인지 고르게 두면 목록이 두 곳으로 갈라진다).
 *
 * **자리 규칙**
 * - `lg`(1024px) 이상: 본문을 **밀어낸다** — 미는 일은 레이아웃 오른쪽 칼럼의 `lg:pr-[31rem]` 이 한다.
 * - `lg` 미만: 본문을 **덮는다**. 백드롭 없음.
 * - 닫기 = 툴바 아이콘을 다시 누르거나 머리줄의 닫기 버튼, `Esc`.
 *
 * **사용 예제**
 * ```tsx
 * <ToolPanel />
 * ```
 *
 * ⚠️ 폭은 `w-[min(28rem,calc(100vw-3rem))]` **하나**로 정한다. `right-12` 로 3rem 띄워 놓고
 *    `w-full max-w-md` 를 주면 28rem 이 안 걸리는 폭에서 왼쪽으로 3rem 넘쳐 가로 스크롤이 생긴다.
 *    28rem 은 레이아웃의 `lg:pr-[31rem]`(패널 28 + 툴바 3)과 **같은 수**다.
 * ⚠️ 바깥 클릭으로는 닫지 않는다 — 패널을 보면서 폼을 만지는 것이 목적이라 바깥 클릭이 정상 동선이다.
 * ❌ `ui/Modal` 로 만들지 말 것 · 백드롭(`fixed inset-0`) · `z-50` 금지 — `npm run lint:ui` 가 잡는다.
 */
export function ToolPanel() {
  const openTool = useToolPanelStore((s) => s.openTool);
  const close = useToolPanelStore((s) => s.close);
  const titleId = useId();

  // Esc 로 닫는다. 닫혀 있을 때는 리스너를 걸지 않는다.
  useEffect(() => {
    if (openTool == null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openTool, close]);

  if (openTool == null) return null;

  const tool = findTool(openTool);
  if (tool == null) return null;
  const { label, Body } = tool;

  return (
    <aside
      aria-labelledby={titleId}
      className="fixed inset-y-0 right-12 z-40 w-[min(28rem,calc(100vw-3rem))] overflow-y-auto border-l border-gray-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h2 id={titleId} className="truncate text-sm font-semibold text-gray-900">
          {label}
        </h2>
        <button
          type="button"
          onClick={close}
          title="닫기"
          aria-label="도구 닫기"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="p-3">
        <Body />
      </div>
    </aside>
  );
}
