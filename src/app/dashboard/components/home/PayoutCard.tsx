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
  /** true = below 768px: the total on its own line, paid (left) and remaining (right) under it. */
  narrow: boolean;
}

const spec = DASHBOARD_CARD_SPECS.SETTLEMENT_PAYOUTS;

/**
 * C6 「정산 지급」 (FEATURE_2610_29 D26 · D30) — this month's payouts summed across sellers and channels, from
 * `GET /api/admin/settlement/month-summary`. The server picks this month in KST and dates a payout by its confirmed
 * payout date, else its scheduled payout date. The three amounts are shown as the server sends them.
 * - Wide: the three amounts side by side (one row high, no room for two lines).
 * - Narrow (`narrowTall`): the total on top, paid on the left and remaining on the right under it.
 */
export function PayoutCard({ editing, onRemove, narrow }: PayoutCardProps) {
  const useCase = useMemo(() => new SettlementUseCase(new SettlementRepositoryImpl()), []);
  const load = useCallback(() => useCase.getMonthSummary(), [useCase]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame title={spec.title} href={spec.href} editing={editing} onRemove={onRemove}>
      <CardBody data={data}>
        {({ total, paid, remaining }) =>
          narrow ? (
            <div className="flex flex-col gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-gray-500">이번 달 지급 예정 총액</p>
                <p className="truncate text-lg font-bold text-gray-900">{formatMoney(total)}원</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-gray-500">지금까지 지급된 금액</p>
                  <p className="truncate text-base font-bold text-gray-900">{formatMoney(paid)}원</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs text-gray-500">남은 지급 예정 금액</p>
                  <p className="truncate text-base font-bold text-gray-900">{formatMoney(remaining)}원</p>
                </div>
              </div>
            </div>
          ) : (
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
          )
        }
      </CardBody>
    </DashboardCardFrame>
  );
}
