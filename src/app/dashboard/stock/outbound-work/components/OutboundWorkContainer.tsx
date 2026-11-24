'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import { WorkTabs } from '@/app/dashboard/stock/components/WorkTabs';
import { OutboundWorkPanel } from './OutboundWorkPanel';

/**
 * 「재고관리 > 출고 작업」 (FEATURE_2611_34 D3 · D4).
 *
 * - Tabs 「폐기」 · 「매입처 반품」 on top. Each tab keeps its own screen seller, screen reason, day and lines; switching
 *   tabs clears nothing — both panels stay mounted and only the visible one takes the page-wide keys (R12 · R20).
 * - The seller list is read once here and shared by both panels.
 */
export type OutboundWorkTab = 'DISPOSAL' | 'SUPPLIER_RETURN';

export function OutboundWorkContainer() {
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const [tab, setTab] = useState<OutboundWorkTab>('DISPOSAL');
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    void sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => setSellers([]));
  }, [sellerUseCase]);

  return (
    <PageContainer title="출고 작업">
      <WorkTabs<OutboundWorkTab>
        tabs={[
          { value: 'DISPOSAL', label: '폐기' },
          { value: 'SUPPLIER_RETURN', label: '매입처 반품' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <OutboundWorkPanel mode="DISPOSAL" active={tab === 'DISPOSAL'} sellers={sellers} />
      <OutboundWorkPanel mode="SUPPLIER_RETURN" active={tab === 'SUPPLIER_RETURN'} sellers={sellers} />
    </PageContainer>
  );
}
