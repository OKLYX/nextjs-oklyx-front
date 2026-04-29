'use client';

import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';

export function TopBar() {
  const router = useRouter();

  const handleLogout = () => {
    tokenStorage.removeToken();
    router.push(ROUTES.LOGIN);
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
      <span className="text-xl font-bold text-gray-900">OKLYX</span>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
