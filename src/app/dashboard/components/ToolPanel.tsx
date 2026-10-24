'use client';

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { findTool } from './toolRegistry';

/**
 * **Fixed right panel** opened by the tool bar (FEATURE_2609_68).
 *
 * **Purpose**: the work surface that draws the body of the tool picked on the tool bar (`ToolRail`). Not a popup —
 *   it does not block scrolling or input on the screen behind it.
 * **File**: src/app/dashboard/components/ToolPanel.tsx
 * **Used in**: `dashboard/layout.tsx` **only**.
 * **Body**: looks up `Body` in `toolRegistry.tsx` by the open tool key — the layout does not pass it
 *   (with two or more tools, letting the layout pick the body would split the list into two places).
 *
 * **Placement**
 * - `lg` (1024px) and up: **pushes** the content — the layout right column's `lg:pr-[32rem]` does the pushing.
 * - Below `lg`: **covers** the content. No backdrop.
 * - Below 768px: the same place, left of the tool bar — the tool bar stays visible to open, close and switch tools
 *   (FEATURE_2610_31 D38).
 * - Below 768px while the tool bar is collapsed (the window narrowed from 768px or wider with a tool open): the panel
 *   is hidden (`max-md:hidden`), not closed — `openTool` and the tool body's state stay, and expanding the bar with
 *   [‹] or widening to 768px or more shows it again (FEATURE_2610_31 D41).
 * - Close = tap the tool icon on the tool bar again, the close button in the header, or `Esc`. Below 768px the
 *   tool bar's collapse button [›] also closes it (FEATURE_2610_31 D44).
 *
 * **Usage**
 * ```tsx
 * <ToolPanel />
 * ```
 *
 * ⚠️ The width is **one** value, `w-[min(28rem,calc(100vw-4rem))]`. With `right-16` keeping 4rem (the tool bar
 *    width) free, a `w-full max-w-md` would overflow 4rem to the left at widths where 28rem does not apply and add
 *    a horizontal scroll bar. 28rem is **the same number** as the layout's `lg:pr-[32rem]` (panel 28 + tool bar 4).
 *    🔴 The three `4rem` places (`right-16` · `calc(100vw-4rem)` · `32rem`) follow `ToolRail`'s `w-16` — change
 *    them together.
 * ⚠️ An outside click does not close it — the point is to touch the form while looking at the panel, so outside
 *    clicks are the normal path.
 * ❌ Do not build it with `ui/Modal` · no backdrop (`fixed inset-0`) · no `z-50` — `npm run lint:ui` catches them.
 */
export function ToolPanel() {
  const openTool = useToolPanelStore((s) => s.openTool);
  const close = useToolPanelStore((s) => s.close);
  // Below 768px a collapsed tool bar hides the panel with CSS (max-md:hidden) and does not close it — the panel stays
  // mounted, so the tool's search text and results are still there when the bar is expanded or the width reaches 768px
  // (FEATURE_2610_31 D41).
  const railCollapsed = useToolPanelStore((s) => s.railCollapsed);
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
      className={`fixed inset-y-0 right-16 z-40 w-[min(28rem,calc(100vw-4rem))] overflow-y-auto border-l border-gray-200 bg-white shadow-lg ${
        railCollapsed ? 'max-md:hidden' : ''
      }`}
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
