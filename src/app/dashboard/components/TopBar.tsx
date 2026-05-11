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
      <button
        onClick={handleLogoClick}
        className="text-xl font-bold text-gray-900 cursor-pointer"
      >
        OKLYX
      </button>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
