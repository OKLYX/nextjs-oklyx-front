'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/config/routes';

/**
 * Navbar 브랜드 헤더 (로고)
 *
 * 용도: 사이드바 최상단의 로고/브랜드 영역. 로고가 필요한 곳은 직접 만들지 말고
 *       항상 이 컴포넌트를 사용.
 * 파일: src/app/dashboard/components/NavbarHeader.tsx
 *
 * 렌더링 위치:
 * - 모든 화면: 좌측 아이콘 레일(Navbar) 상단. 항상 `collapsible`. 평소엔 로고만,
 *   호버 시 브랜드 텍스트 노출. 핀 상태에선 항상 노출됨.
 *
 * Props:
 * - collapsible: 레일 모드(현재 항상 true). 라벨을 호버(group-hover) 시에만 노출.
 * - pinned: 핀 고정 상태. true면 라벨 항상 노출.
 *
 * ⚠️ 사이드바 토글(햄버거)은 여기 없다 — 상단 바 맨 왼쪽(`dashboard/layout.tsx`)에 있다.
 *    레일 안에 두면 호버해야 보여서, 접힌 상태에서 펼칠 방법이 눈에 띄지 않았다.
 * ⚠️ group-hover는 layout.tsx의 레일 wrapper(`group`)에 의존.
 */
export function NavbarHeader({
  collapsible = false,
  pinned = false,
}: {
  collapsible?: boolean;
  pinned?: boolean;
}) {
  const collapsed = collapsible && !pinned;
  const labelCls = collapsed ? 'hidden group-hover:inline' : '';

  return (
    <div className="flex items-center py-3">
      <Link
        href={ROUTES.DASHBOARD}
        className="flex flex-1 items-center text-xl font-bold text-gray-900"
      >
        {/* Fixed-width centered logo column (w-16) — identical geometry to the
            menu icon columns, in every state, so the logo shares the menu
            icons' x-position (centers align at the rail's 32px). */}
        <span className="flex shrink-0 items-center justify-center w-16">
          <Image
            src="/icon.png"
            alt="OKLYX 로고"
            width={28}
            height={28}
            className="object-contain shrink-0"
          />
        </span>
        <span className={`whitespace-nowrap ${labelCls}`}>OCLYX</span>
      </Link>
    </div>
  );
}
