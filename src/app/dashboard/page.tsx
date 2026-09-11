'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { PageContainer } from '@/presentation/components/PageContainer';

export default function DashboardPage() {
  const resetNavigation = useNavigationStore((state) => state.resetNavigation);

  // Collapse all navbar menus when landing on the dashboard home.
  useEffect(() => {
    resetNavigation();
  }, [resetNavigation]);

  return (
    <PageContainer title="Welcome to OCLYX">
      <></>
    </PageContainer>
  );
}
