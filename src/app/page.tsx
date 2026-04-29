'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = tokenStorage.getToken();

    if (token) {
      router.push(ROUTES.DASHBOARD);
    } else {
      router.push(ROUTES.LOGIN);
    }
  }, [router]);

  return null;
}
