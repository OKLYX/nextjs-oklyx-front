'use client';

import { useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';

// Viewport width at/above which the sidebar defaults to expanded (pushed).
// = content min-w (1080px) + expanded sidebar (w-56 = 224px). Below it the
// sidebar defaults to the collapsed icon rail.
const EXPAND_BREAKPOINT = 1304;

// Sidebar behaviour:
//  - Width-driven default: wide screens start expanded (pushes content, pl-56),
//    narrow screens start as the collapsed icon rail (pl-16). The default only
//    flips when the viewport CROSSES the breakpoint, so a manual toggle sticks
//    until the next crossing instead of being overridden on every resize tick.
//  - Collapsed rail: hover peeks open to w-56 as a floating overlay (no reflow).
//  - Hamburger: pins open (push) / collapses, at any width.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSidebarOpen = useNavigationStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useNavigationStore((state) => state.setSidebarOpen);

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

  return (
    <div className="min-h-screen flex">
      <aside
        onMouseEnter={() => {
          hovering.current = true;
        }}
        onMouseLeave={() => {
          hovering.current = false;
          setPeekSuppressed(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 overflow-x-hidden overflow-y-auto border-r border-gray-200 bg-white shadow-sm transition-[width] duration-200 ${
          isSidebarOpen
            ? 'w-56'
            : peekSuppressed
              ? 'w-16'
              : 'group w-16 hover:w-56 hover:shadow-xl'
        }`}
      >
        <Navbar collapsible pinned={isSidebarOpen} />
      </aside>

      {/* Right column: top bar over the content area, then the page content
          below. Padding tracks the rail — pl-16 collapsed, pl-56 when pinned
          (so the pinned rail pushes content rather than overlaying it). */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-[padding] duration-200 ${
          isSidebarOpen ? 'pl-56' : 'pl-16'
        }`}
      >
        <div className="flex items-stretch bg-white">
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </div>
        <main className="flex-1 p-6 min-w-0 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
