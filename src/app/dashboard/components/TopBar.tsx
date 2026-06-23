'use client';

import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { ROUTES } from '@/config/routes';

export function TopBar() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const resetNavigation = useNavigationStore((state) => state.resetNavigation);
  const toggleSidebar = useNavigationStore((state) => state.toggleSidebar);

  const handleLogout = () => {
    tokenStorage.removeToken();
    logout();
    resetNavigation();
    router.push(ROUTES.LOGIN);
  };

  const handleLogoClick = () => {
    router.push(ROUTES.DASHBOARD);
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={handleLogoClick}
          className="text-xl font-bold text-gray-900 cursor-pointer"
        >
          OCLYX
        </button>
        {/* Hamburger — narrow viewports only (< 1304px); toggles the sidebar drawer */}
        <button
          onClick={toggleSidebar}
          aria-label="메뉴 열기"
          className="min-[1304px]:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-900"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
