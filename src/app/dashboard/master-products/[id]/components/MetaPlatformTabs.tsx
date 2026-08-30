'use client';

import { useState, type ReactNode } from 'react';

// Real platforms today = COUPANG only. Push here when a second mall's adapter lands;
// the tab bar grows automatically and each tab lazily loads its own schema/values.
export const META_PLATFORMS = ['COUPANG'] as const;

interface MetaPlatformTabsProps {
  // Renders the active platform's container. key=platform forces a remount (lazy re-fetch)
  // on tab switch so one platform's failure never affects another tab.
  children: (platform: string) => ReactNode;
}

/**
 * 카테고리 메타(필수속성/고시) 플랫폼 탭 래퍼 — 상세·추가 공통.
 * File: src/app/dashboard/master-products/[id]/components/MetaPlatformTabs.tsx
 *
 * 탭 바(플랫폼별) + 활성 탭 = 컨테이너 1개 렌더. 탭 전환 시 그 플랫폼으로 remount(lazy).
 * 플랫폼이 1개여도 단일 탭 바를 노출해 후속 플랫폼 추가 시 UI 가 그대로 확장된다.
 */
export function MetaPlatformTabs({ children }: MetaPlatformTabsProps) {
  const [active, setActive] = useState<string>(META_PLATFORMS[0]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-gray-200">
        {META_PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActive(p)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
              active === p
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div key={active}>{children(active)}</div>
    </div>
  );
}
