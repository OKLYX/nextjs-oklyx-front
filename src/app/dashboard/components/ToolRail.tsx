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
 * ⚠️ 툴바 폭(`w-16` = 4rem)은 **접힌 사이드바 레일과 같은 값**이다(`layout.tsx` 의 `w-16`/`pl-16`)
 *    — 거울상이라는 말이 폭에도 적용된다. 레이아웃 오른쪽 패딩(`pr-16`)·패널 `right-16` 과 한 묶음이니
 *    한쪽만 바꾸지 말 것.
 * ⚠️ 아이콘 크기(`size={24}` = 24px)도 **사이드바 메뉴 아이콘(`Navbar` 의 `w-6 h-6`)과 같은 값**이다.
 *    한쪽만 키우면 두 줄의 아이콘이 서로 다른 크기로 마주 본다.
 * ❌ `z-50` 금지(사이드바·`ui/Modal` 층) · `fixed inset-0` 금지 — `npm run lint:ui` 가 잡는다.
 * ❌ 툴바 안에서 드롭다운(`absolute`)을 띄우지 말 것 — 폭이 `w-16` 라 자리를 못 잡고, 오른쪽에서
 *    `ToolPanel` 과 겹친다. 도구 본문은 **언제나 패널**에 그린다.
 */
export function ToolRail() {
  const openTool = useToolPanelStore((s) => s.openTool);
  const toggle = useToolPanelStore((s) => s.toggle);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-16 flex-col items-center gap-2 border-l border-gray-200 bg-white py-3">
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
    </div>
  );
}
