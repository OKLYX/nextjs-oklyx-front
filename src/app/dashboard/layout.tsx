'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
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
//    default (-translate-x-full); the md:hidden TopBar hamburger opens it as an
//    overlay with a backdrop. Tapping the backdrop, a menu item (route change),
//    or the in-drawer hamburger closes it. Content has no left padding (pl-0).
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const isSidebarOpen = useNavigationStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useNavigationStore((state) => state.setSidebarOpen);
  const toggleSidebar = useNavigationStore((state) => state.toggleSidebar);
  const closeSidebar = useNavigationStore((state) => state.closeSidebar);

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
          pinned (push). Mobile has no rail, so pl-0 (drawer overlays). */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-[padding] duration-200 ${
          isMobile ? 'pl-0' : isSidebarOpen ? 'pl-56' : 'pl-16'
        }`}
      >
        <div className="flex items-stretch bg-white">
          {/* Mobile-only menu trigger — the in-drawer hamburger is off-screen
              when the drawer is closed, so the drawer needs this opener. */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="메뉴 열기"
            className="md:hidden shrink-0 pl-4 pr-2 text-gray-900 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
