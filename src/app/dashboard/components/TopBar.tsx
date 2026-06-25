'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { useThemeStore } from '@/infrastructure/stores/themeStore';
import { ROUTES } from '@/config/routes';

export function TopBar() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const resetNavigation = useNavigationStore((state) => state.resetNavigation);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  // Avoid hydration mismatch: theme is resolved from localStorage on the client,
  // so render the light state until mounted (false on server, true on client).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isDark = mounted && theme === 'dark';

  const handleLogout = () => {
    tokenStorage.removeToken();
    logout();
    resetNavigation();
    router.push(ROUTES.LOGIN);
  };

  return (
    <header className="flex items-center justify-end px-6 py-3 bg-white">
      <div className="flex items-center gap-3">
        {/* Theme switch — toggles Light/Dark mode (persisted via themeStore) */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={toggleTheme}
          className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-700 shadow transform transition-transform ${
              isDark ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </span>
        </button>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
