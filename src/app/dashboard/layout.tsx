'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';

// Viewport width at which the sidebar collapses into a hamburger drawer.
// = PageContainer min-w (1080px) + sidebar width (w-56 = 224px).
// Below this, the static sidebar is hidden and toggled via the TopBar hamburger.
// Must match the `min-[1304px]:` / `min-w-[1080px]` values used below + in PageContainer.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSidebarOpen = useNavigationStore((state) => state.isSidebarOpen);
  const closeSidebar = useNavigationStore((state) => state.closeSidebar);
  const pathname = usePathname();

  // Auto-close the mobile drawer whenever the route changes (link clicked)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1">
        {/* Static sidebar — wide viewports only (>= 1304px) */}
        <div className="hidden min-[1304px]:block">
          <Navbar />
        </div>
        <main className="flex-1 p-6 min-w-0 overflow-x-auto">{children}</main>
      </div>

      {/* Hamburger drawer — narrow viewports only (< 1304px) */}
      <div className="min-[1304px]:hidden">
        <div
          onClick={closeSidebar}
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
            isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 overflow-y-auto bg-white shadow-xl transition-transform duration-200 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Navbar />
        </div>
      </div>
    </div>
  );
}
