'use client';

import { useId, type ReactNode } from 'react';
import { ChevronRight, Search } from 'lucide-react';

/**
 * 물품 등록 화면 오른쪽의 **참고 패널 틀**(FEATURE_2609_67).
 *
 * **용도**: 마켓 상품을 보면서 등록 칸을 채우도록, 폼 옆에 작업 표면 하나를 붙인다.
 * **파일**: src/app/dashboard/products/register/components/ReferencePanel.tsx
 * **쓰는 곳**: 물품 등록 폼(`ProductRegistrationForm`) 하나뿐이다 — 다른 화면에 달지 않는다.
 *
 * **자리 규칙**(PLAN/D2)
 * - `lg`(1024px) 이상: 폼 오른쪽 칼럼(`w-96 shrink-0`), `sticky` 로 스크롤해도 따라온다.
 * - `lg` 미만: 오른쪽에서 화면을 **덮는다**. 🔴 폼 아래로 내려가지 않는다 — 내려가면
 *   "보면서 입력한다"는 목적 자체가 사라진다.
 * - 닫혀 있으면 오른쪽 가장자리에 손잡이만 남는다.
 *
 * **사용 예제**
 * ```tsx
 * <ReferencePanel open={panelOpen} onOpenChange={setPanelOpen}>
 *   <ChannelProductTool … />
 * </ReferencePanel>
 * ```
 *
 * ⚠️ 이 컴포넌트는 `<form>` **안에** 산다. 안에 놓는 버튼은 `type="button"` 이어야 하고,
 *    텍스트 입력에는 Enter 가드가 있어야 한다(도구 컴포넌트 책임).
 * ⚠️ 넓은 칼럼과 좁은 화면 덮개는 **서로 다른 DOM 두 개**다(`hidden lg:flex` / `lg:hidden`).
 *    미디어쿼리로 한 덩어리의 `position` 을 바꾸면 스크롤 위치가 튄다. 그래서 `children` 이
 *    두 번 그려지고, 도구의 내부 상태(검색 결과)는 폭마다 따로다 — 화면에 보이는 것은 늘 하나이고,
 *    담은 사진처럼 폭을 넘어 유지돼야 하는 값은 **컨테이너가 소유**한다.
 * ❌ 백드롭(`fixed inset-0`) · `z-50` · `ui/Modal` 로 만들기 금지 — 팝업이 아니라 작업 표면이고,
 *    뒤 폼의 스크롤·입력을 막지 않는다. `npm run lint:ui` 가 앞의 둘을 잡는다.
 */

/** 도구 목록. 🔴 지금은 하나다 — 별도 파일·레지스트리·탭 추상화를 만들지 않는다(PLAN/D1). */
const TOOLS = [{ key: 'channel', label: '플랫폼 상품 조회', Icon: Search }] as const;

interface ReferencePanelProps {
  /** 패널 본문. 지금은 도구가 하나뿐이라 이 컴포넌트는 '틀'만 소유한다. */
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferencePanel({ children, open, onOpenChange }: ReferencePanelProps) {
  const titleId = useId();

  const rail = (onCollapse?: () => void) => (
    <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-gray-200 bg-gray-50 py-3">
      {TOOLS.map(({ key, label, Icon }) => (
        <span
          key={key}
          title={label}
          aria-label={label}
          className="flex h-8 w-8 items-center justify-center rounded bg-white text-blue-600 shadow-sm"
        >
          <Icon size={16} aria-hidden />
        </span>
      ))}
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          title="접기"
          aria-label="참고 패널 접기"
          className="mt-auto flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
    </div>
  );

  const header = (
    <h2 id={titleId} className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
      {TOOLS[0].label}
    </h2>
  );

  return (
    <>
      {/* 넓은 화면: 폼 오른쪽 칼럼 */}
      <aside
        aria-labelledby={titleId}
        className="hidden lg:flex lg:sticky lg:top-6 w-96 shrink-0 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        {rail()}
        <div className="min-w-0 flex-1">
          {header}
          <div className="p-3">{children}</div>
        </div>
      </aside>

      {/* 좁은 화면: 오른쪽에서 폼을 덮는다(아래로 내려가지 않는다) */}
      <aside
        aria-labelledby={titleId}
        aria-hidden={!open}
        className={`lg:hidden fixed inset-y-0 right-0 z-40 flex w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white shadow-lg transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {rail(() => onOpenChange(false))}
        <div className="min-w-0 flex-1">
          {header}
          <div className="p-3">{children}</div>
        </div>
      </aside>

      {/* 닫혀 있을 때 여는 손잡이 */}
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="참고 패널 열기"
          className="lg:hidden fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-r-0 border-gray-200 bg-white px-2 py-3 shadow"
        >
          <Search size={16} aria-hidden />
        </button>
      )}
    </>
  );
}
