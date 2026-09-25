'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { ToolRail } from './components/ToolRail';
import { ToolPanel } from './components/ToolPanel';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { useAlertSummaryPolling } from '@/presentation/hooks/useAlertSummaryPolling';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { AuthRepositoryImpl } from '@/infrastructure/repositories/AuthRepositoryImpl';
import { ROUTES } from '@/config/routes';

// Viewport width at/above which the sidebar defaults to expanded (pushed).
// = content min-w (1080px) + expanded sidebar (w-56 = 224px). Below it the
// sidebar defaults to the collapsed icon rail.
const EXPAND_BREAKPOINT = 1304;

// Sidebar behaviour:
//  - md and up (desktop): a fixed icon rail. Width-driven default — wide screens
//    start expanded (pushes content, pl-56), narrower screens start as the
//    collapsed icon rail (pl-16). The default only flips when the viewport
//    CROSSES the breakpoint, so a manual toggle sticks until the next crossing
//    instead of being overridden on every resize tick. Collapsed rail hover
//    peeks open to w-56 as a floating overlay (no reflow). Hamburger pins/collapses.
//  - Below md (mobile): an off-canvas drawer instead of the rail. Hidden by
//    default (-translate-x-full); the same top-bar button opens it as an
//    overlay with a backdrop. Tapping the backdrop, a menu item (route change),
//    or the button again closes it. Content has no left padding (pl-0).
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  // 🔴 알림 숫자 폴링의 유일한 호출부(2609_51 Step 2). 사이드바 배지·상단 종·알림 센터가 모두
  // `alertStore` 를 읽으므로, 여기 한 번만 돌면 화면 수와 무관하게 호출량이 고정된다.
  useAlertSummaryPolling();
  const isSidebarOpen = useNavigationStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useNavigationStore((state) => state.setSidebarOpen);
  const toggleSidebar = useNavigationStore((state) => state.toggleSidebar);
  const closeSidebar = useNavigationStore((state) => state.closeSidebar);
  // 오른쪽 도구 패널(FEATURE_2609_68). 열려 있으면 넓은 화면에서 본문을 그만큼 밀어낸다.
  const openTool = useToolPanelStore((state) => state.openTool);

  // Session restore: validate the session against the server and refresh the
  // access token on dashboard entry (a page reload may have expired the 30-min
  // access token). The axios interceptor refreshes on 401 and retries; if the
  // refresh also fails it redirects to /login via clearAndRedirect.
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const authRepository = useMemo(() => new AuthRepositoryImpl(), []);

  useEffect(() => {
    if (!tokenStorage.getToken() && !tokenStorage.getRefreshToken()) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    authRepository
      .me()
      .then((data) => {
        tokenStorage.setToken(data.token);
        setUser({ email: data.email, name: data.name, role: data.role as 'GUEST' | 'USER' | 'ADMIN' });
      })
      .catch(() => {
        // 401 handled by the interceptor (refresh → redirect on failure).
      });
  }, [authRepository, router, setUser]);

  // Flip the default only when the viewport crosses the breakpoint.
  const wasWide = useRef<boolean | null>(null);
  useEffect(() => {
    const apply = () => {
      const wide = window.innerWidth >= EXPAND_BREAKPOINT;
      if (wasWide.current !== wide) {
        wasWide.current = wide;
        setSidebarOpen(wide);
      }
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [setSidebarOpen]);

  // After collapsing while the cursor is over the rail, suppress the hover-peek
  // until the pointer leaves — otherwise `hover:w-56` would instantly re-expand
  // it. Only the click-collapse (cursor on rail) suppresses; a resize-collapse
  // (cursor elsewhere) does not.
  const hovering = useRef(false);
  const wasOpen = useRef(isSidebarOpen);
  const [peekSuppressed, setPeekSuppressed] = useState(false);
  useEffect(() => {
    if (wasOpen.current && !isSidebarOpen && hovering.current) {
      setPeekSuppressed(true);
    }
    wasOpen.current = isSidebarOpen;
  }, [isSidebarOpen]);

  // Mobile drawer: close on route change so tapping a menu item both navigates
  // and dismisses the overlay. Desktop rail stays put across navigations.
  const pathname = usePathname();
  useEffect(() => {
    if (isMobile) closeSidebar();
  }, [pathname, isMobile, closeSidebar]);

  return (
    <div className="min-h-screen flex">
      {/* Mobile-only backdrop behind the open drawer; tap to dismiss. */}
      {isMobile && isSidebarOpen && (
        <div
          onClick={closeSidebar}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        onMouseEnter={() => {
          hovering.current = true;
        }}
        onMouseLeave={() => {
          hovering.current = false;
          setPeekSuppressed(false);
        }}
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-gray-200 bg-white shadow-lg transition-transform duration-200 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `fixed inset-y-0 left-0 z-50 overflow-x-hidden overflow-y-auto border-r border-gray-200 bg-white shadow-sm transition-[width] duration-200 ${
                isSidebarOpen
                  ? 'w-56'
                  : peekSuppressed
                    ? 'w-16'
                    : 'group w-16 hover:w-56 hover:shadow-xl'
              }`
        }
      >
        {/* Mobile drawer pins labels open (pinned); desktop follows rail state. */}
        <Navbar collapsible pinned={isMobile ? true : isSidebarOpen} />
      </aside>

      {/* Right column: top bar over the content area, then the page content
          below. Desktop padding tracks the rail — pl-16 collapsed, pl-56 when
          pinned (push). Mobile has no rail, so pl-0 (drawer overlays).
          오른쪽은 도구 툴바(w-16 = 4rem, **접힌 왼쪽 레일과 같은 폭**)가 늘 자리를 차지하고(pr-16),
          패널은 lg 이상일 때만 본문을 민다(lg:pr-[32rem] = 패널 28rem + 툴바 4rem). 🔴 패딩을 `main` 이 아니라 이 div 에
          거는 이유: main 에만 걸면 위의 상단바 행이 패딩을 못 받아 [Logout]·테마 스위치가 레일
          밑에 깔려 눌리지 않는다. */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-[padding] duration-200 pr-16 ${
          isMobile ? 'pl-0' : isSidebarOpen ? 'pl-56' : 'pl-16'
        } ${openTool ? 'lg:pr-[32rem]' : ''}`}
      >
        <div className="flex items-stretch bg-white">
          {/* Sidebar toggle — the only one. Lives at the top bar's far left on
              every screen size: desktop pins/collapses the rail, mobile opens
              and closes the drawer (whose own hamburger is off-screen while
              closed). Previously it sat inside the rail header, where a
              collapsed rail hid it until hover. */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              isMobile
                ? isSidebarOpen
                  ? '메뉴 닫기'
                  : '메뉴 열기'
                : isSidebarOpen
                  ? '메뉴 고정 해제'
                  : '메뉴 고정'
            }
            aria-expanded={isSidebarOpen}
            className="shrink-0 pl-4 pr-2 text-gray-900 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </div>
        {/* 🔴 overflow-x-clip 이다(auto 아님, 2609_73). `auto` 면 세로축까지 스크롤 영역으로
            계산돼(CSS: 한 축이 visible 이 아니면 다른 축의 visible 은 auto 로 계산) 이 안의 sticky
            가 전부 죽는다 — 이 영역은 높이 제한이 없어 실제로는 스크롤하지 않으므로 붙을 기준이
            없다(2026-09-25 실측). 가로로 넓은 목록 표는 자기 스크롤을 이미 갖고 있다
            (globals.css `.list-table-scroll`). overflow-x 를 **없애지도 말 것** — 넓은 내용이
            오른쪽 툴바 위로 겹치고 페이지 전체에 가로 스크롤바가 생긴다. */}
        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-clip">{children}</main>
      </div>

      {/* 전역 도구(FEATURE_2609_68). 🔴 도구는 화면에 속하지 않는다 — 레이아웃이 직접 그린다.
          도구 목록(플랫폼 상품 조회 · 클립보드)은 `components/toolRegistry.tsx` 한 곳에 있다. */}
      <ToolPanel />
      <ToolRail />
    </div>
  );
}
