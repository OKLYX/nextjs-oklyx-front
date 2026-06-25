'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { ROUTES } from '@/config/routes';

/**
 * Navbar 브랜드 헤더 (로고 + 햄버거 핀 토글)
 *
 * 용도: 로고와 사이드바 핀(고정) 토글 버튼을 한 곳에서 관리하는 공통 헤더.
 * 필수 규칙: 로고/햄버거가 필요한 곳은 직접 만들지 말고 항상 이 컴포넌트를 사용.
 * 파일: src/app/dashboard/components/NavbarHeader.tsx
 *
 * 렌더링 위치:
 * - 모든 화면: 좌측 아이콘 레일(Navbar) 상단. 항상 `collapsible`. 평소엔 로고만,
 *   호버 시 브랜드 텍스트 + 햄버거 노출. 햄버거 클릭 → `toggleSidebar`로 펼침 고정(핀).
 *   핀 상태에선 라벨/햄버거가 항상 노출됨.
 *
 * Props:
 * - collapsible: 레일 모드(현재 항상 true). 라벨/햄버거를 호버(group-hover) 시에만 노출.
 * - pinned: 핀 고정 상태. true면 라벨/햄버거 항상 노출.
 *
 * ⚠️ group-hover는 layout.tsx의 레일 wrapper(`group`)에 의존.
 */
export function NavbarHeader({
  collapsible = false,
  pinned = false,
}: {
  collapsible?: boolean;
  pinned?: boolean;
}) {
  const toggleSidebar = useNavigationStore((state) => state.toggleSidebar);

  const collapsed = collapsible && !pinned;
  const labelCls = collapsed ? 'hidden group-hover:inline' : '';
  const hamburgerCls = collapsed ? 'hidden group-hover:block' : '';

  return (
    <div className="flex items-center py-3 border-b border-gray-200">
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
      {/* Hamburger — narrow rail only; toggles the pinned (fixed-open) state */}
      {collapsible && (
        <button
          onClick={toggleSidebar}
          aria-label={pinned ? '메뉴 고정 해제' : '메뉴 고정'}
          className={`shrink-0 pr-4 text-gray-900 hover:text-gray-600 transition-colors ${hamburgerCls}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      )}
    </div>
  );
}
