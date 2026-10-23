'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { DashboardHome } from './components/home/DashboardHome';

export default function DashboardPage() {
  const resetNavigation = useNavigationStore((state) => state.resetNavigation);

  // Collapse all navbar menus when landing on the dashboard home.
  useEffect(() => {
    resetNavigation();
  }, [resetNavigation]);

  return <DashboardHome />;
}
