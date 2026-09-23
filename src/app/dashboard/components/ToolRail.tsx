'use client';

import { Fragment } from 'react';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { TOOLS } from './toolRegistry';

/**
 * 대시보드 오른쪽 끝 **세로 도구 툴바** (FEATURE_2609_68).
 *
 * **용도**: 어느 화면에서나 같은 자리에서 도구를 열고 닫는다. 왼쪽 사이드바(`Navbar`)의 거울상이다.
 * **파일**: src/app/dashboard/components/ToolRail.tsx
 * **쓰는 곳**: `dashboard/layout.tsx` **한 곳뿐**이다 — 화면마다 달지 않는다.
 * **상태**: `toolPanelStore` (열린 도구 하나). 본문은 `ToolPanel` 이 그린다.
 * **도구 목록**: `toolRegistry.tsx` 한 곳에서 온다 — 여기에 아이콘을 손으로 더하지 않는다.
 *
 * **사용 예제**
 * ```tsx
 * <ToolPanel />
 * <ToolRail />
 * ```
 *
 * ⚠️ 툴바는 **항상 보인다** — 좁은 화면에서도 숨기지 않는다(모든 화면에서 확인 가능해야 한다).
 * ⚠️ 툴바 폭(`w-12` = 3rem)은 레이아웃 오른쪽 패딩(`pr-12`)과 **같은 수**다. 한쪽만 바꾸지 말 것.
 * ❌ `z-50` 금지(사이드바·`ui/Modal` 층) · `fixed inset-0` 금지 — `npm run lint:ui` 가 잡는다.
 * ❌ 툴바 안에서 드롭다운(`absolute`)을 띄우지 말 것 — 폭이 `w-12` 라 자리를 못 잡고, 오른쪽에서
 *    `ToolPanel` 과 겹친다. 도구 본문은 **언제나 패널**에 그린다.
 */
export function ToolRail() {
  const openTool = useToolPanelStore((s) => s.openTool);
  const toggle = useToolPanelStore((s) => s.toggle);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-12 flex-col items-center gap-2 border-l border-gray-200 bg-white py-3">
      {TOOLS.map(({ key, label, Icon, RailSlot }) => {
        const button = (
          <button
            type="button"
            onClick={() => toggle(key)}
            title={label}
            aria-label={label}
            aria-pressed={openTool === key}
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              openTool === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon size={16} aria-hidden />
          </button>
        );
        // 배지·드롭존이 있는 도구(클립보드)는 자기 껍데기로 버튼을 감싼다.
        return <Fragment key={key}>{RailSlot ? <RailSlot>{button}</RailSlot> : button}</Fragment>;
      })}
    </div>
  );
}
