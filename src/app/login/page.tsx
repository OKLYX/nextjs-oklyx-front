'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Login</h1>
        <p className="text-gray-600">Public route - login page</p>
      </div>
    </div>
  );
}
