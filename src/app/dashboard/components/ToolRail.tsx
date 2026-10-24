'use client';

import { Fragment } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { TOOLS } from './toolRegistry';

/**
 * Vertical **tool bar** at the right edge of the dashboard (FEATURE_2609_68).
 *
 * **Purpose**: opens and closes the tools from the same place on every screen. The mirror image of the left
 * sidebar (`Navbar`).
 * **File**: src/app/dashboard/components/ToolRail.tsx
 * **Used in**: `dashboard/layout.tsx` **only** — screens do not mount it.
 * **State**: `toolPanelStore` (the one open tool · `railCollapsed`). `ToolPanel` draws the body.
 * **Tool list**: comes from `toolRegistry.tsx` only — do not add icons here by hand.
 *
 * **Usage**
 * ```tsx
 * <ToolPanel />
 * <ToolRail />
 * ```
 *
 * ⚠️ At 768px and up the bar stays visible and has no collapse button — it cannot be hidden (FEATURE_2610_31 D45).
 * ⚠️ Below 768px the bar can be collapsed (FEATURE_2610_31 D39 · D40 · D44): the [›] button at the bottom of the
 *    bar closes the open tool (`close()`) and then collapses the bar; while collapsed, the bar is not drawn and the
 *    [‹] handle sits at the vertical middle of the right edge — tapping it expands the bar. Taps, no swipe. A reload
 *    starts collapsed (`railCollapsed` is not persisted — D41 · D42).
 * ⚠️ The bar width (`w-16` = 4rem) is **the same value as the collapsed sidebar rail** (`w-16` · `pl-16` in
 *    `layout.tsx`) — the mirror image holds for the width too. It goes together with the layout's right padding
 *    (`pr-16`) and the panel's `right-16`; do not change one side only.
 * ⚠️ The icon size (`size={24}` = 24px) is **the same value as the sidebar menu icons** (`w-6 h-6` in `Navbar`).
 *    Growing one side only makes the two rows of icons face each other at different sizes.
 * ❌ No `z-50` (sidebar · `ui/Modal` layer) · no `fixed inset-0` — `npm run lint:ui` catches them.
 * ❌ Do not open a dropdown (`absolute`) inside the bar — at `w-16` it has no room and overlaps `ToolPanel` on the
 *    right. A tool body is **always** drawn in the panel.
 */
export function ToolRail() {
  const openTool = useToolPanelStore((s) => s.openTool);
  const toggle = useToolPanelStore((s) => s.toggle);
  const close = useToolPanelStore((s) => s.close);
  const railCollapsed = useToolPanelStore((s) => s.railCollapsed);
  const collapseRail = useToolPanelStore((s) => s.collapseRail);
  const expandRail = useToolPanelStore((s) => s.expandRail);

  return (
    <>
      <div
        className={`fixed inset-y-0 right-0 z-40 flex w-16 flex-col items-center gap-2 border-l border-gray-200 bg-white py-3 ${
          railCollapsed ? 'max-md:hidden' : ''
        }`}
      >
        {TOOLS.map(({ key, label, Icon, RailSlot }) => {
          const button = (
            <button
              type="button"
              onClick={() => toggle(key)}
              title={label}
              aria-label={label}
              aria-pressed={openTool === key}
              className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
                openTool === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {/* 24px = `Navbar` 메뉴 아이콘(`w-6 h-6`)과 같은 크기. 버튼(40px)은 그 아이콘을 담는
                  누를 자리이며, 툴바 폭 `w-16`(64px) 안에서 좌우가 고르게 남는다. */}
              <Icon size={24} aria-hidden />
            </button>
          );
          // 배지·드롭존이 있는 도구(클립보드)는 자기 껍데기로 버튼을 감싼다.
          return <Fragment key={key}>{RailSlot ? <RailSlot>{button}</RailSlot> : button}</Fragment>;
        })}
        {/* Collapse button — below 768px, at the bottom of the bar, the same size and look as a tool button
            (FEATURE_2610_31 D39 · D45). It closes the open tool first, then collapses the bar (D44). */}
        <button
          type="button"
          onClick={() => {
            close();
            collapseRail();
          }}
          title="도구 막대 접기"
          aria-label="도구 막대 접기"
          className="mt-auto flex h-10 w-10 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 md:hidden"
        >
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
      {/* Handle of the collapsed bar — below 768px, right edge, vertical middle, 40px high · 24px wide, no clipboard
          count (FEATURE_2610_31 D39 · D43). */}
      {railCollapsed && (
        <button
          type="button"
          onClick={expandRail}
          title="도구 막대 펴기"
          aria-label="도구 막대 펴기"
          className="fixed right-0 top-1/2 z-40 flex h-10 w-6 -translate-y-1/2 items-center justify-center rounded-l border-y border-l border-gray-200 bg-white text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
      )}
    </>
  );
}
