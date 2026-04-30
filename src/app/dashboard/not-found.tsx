'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function DashboardNotFound() {
  const router = useRouter();

  useEffect(() => {
    window.onunload = () => {};
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg text-gray-600">Page Not Found</p>
      <p className="text-lg text-gray-600">The page you are looking for does not exist.</p>
      <button
        onClick={() => router.push(ROUTES.DASHBOARD)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
