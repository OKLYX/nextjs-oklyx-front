'use client';

import { useCallback, useMemo } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import { formatMoney } from '@/domain/entities/SalesSummary';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { useCardData } from './useCardData';

interface PayoutCardProps {
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.SETTLEMENT_PAYOUTS;

/**
 * C6 「정산 지급」 (FEATURE_2610_29 D26 · D30) — this month's payouts summed across sellers and channels, from
 * `GET /api/admin/settlement/month-summary`. The server picks this month in KST and dates a payout by its confirmed
 * payout date, else its scheduled payout date. The three amounts are shown as the server sends them.
 */
export function PayoutCard({ editing, onRemove }: PayoutCardProps) {
  const useCase = useMemo(() => new SettlementUseCase(new SettlementRepositoryImpl()), []);
  const load = useCallback(() => useCase.getMonthSummary(), [useCase]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame title={spec.title} href={spec.href} editing={editing} onRemove={onRemove}>
      <CardBody data={data}>
        {({ total, paid, remaining }) => (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '이번 달 지급 예정 총액', value: total },
              { label: '지금까지 지급된 금액', value: paid },
              { label: '남은 지급 예정 금액', value: remaining },
            ].map((entry) => (
              <div key={entry.label} className="min-w-0">
                <p className="truncate text-xs text-gray-500">{entry.label}</p>
                <p className="truncate text-base font-bold text-gray-900">{formatMoney(entry.value)}원</p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
