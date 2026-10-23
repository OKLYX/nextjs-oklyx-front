'use client';

import { useCallback, useMemo } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { PurchaseListUseCase } from '@/application/usecases/PurchaseListUseCase';
import { PurchaseListRepositoryImpl } from '@/infrastructure/repositories/PurchaseListRepositoryImpl';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { useCardData } from './useCardData';

interface PurchaseListCardProps {
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.PURCHASE_LIST;

/**
 * C7 「구매목록 남은 품목」 (FEATURE_2610_29 D27) — the number of products still to buy: the `items` of the purchase
 * list without a seller filter (one item = one product).
 */
export function PurchaseListCard({ editing, onRemove }: PurchaseListCardProps) {
  const useCase = useMemo(() => new PurchaseListUseCase(new PurchaseListRepositoryImpl()), []);
  const load = useCallback(async () => (await useCase.getList()).items.length, [useCase]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame title={spec.title} href={spec.href} editing={editing} onRemove={onRemove}>
      <CardBody data={data}>
        {(count) => (
          <p className="text-2xl font-bold text-gray-900">
            {count.toLocaleString('ko-KR')}
            <span className="ml-1 text-sm font-normal text-gray-500">종</span>
          </p>
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
