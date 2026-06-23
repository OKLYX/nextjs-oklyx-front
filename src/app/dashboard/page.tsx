'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';

export default function DashboardPage() {
  const resetNavigation = useNavigationStore((state) => state.resetNavigation);

  // Collapse all navbar menus when landing on the dashboard home.
  useEffect(() => {
    resetNavigation();
  }, [resetNavigation]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Welcome to OCLYX</h1>
    </div>
  );
}
