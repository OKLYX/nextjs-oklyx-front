'use client';

import { useCallback, useMemo, useState } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import { formatMoney } from '@/domain/entities/SalesSummary';
import type { Seller } from '@/domain/entities/SellerEntity';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { SellerSelect } from './SellerSelect';
import { useCardData } from './useCardData';

interface PayoutCardProps {
  /** Seller list of the dashboard (FEATURE_2610_30 D37). */
  sellers: Seller[];
  editing: boolean;
  onRemove: () => void;
  /** true = below 768px: the card is `narrowTall`, so each amount gets its label on its own line. */
  narrow: boolean;
}

const spec = DASHBOARD_CARD_SPECS.SETTLEMENT_PAYOUTS;

/**
 * C6 「정산 지급」 (FEATURE_2610_29 D26 · D30) — this month's payouts summed across channels, from
 * `GET /api/admin/settlement/month-summary`. The server picks this month in KST and dates a payout by its confirmed
 * payout date, else its scheduled payout date. The three amounts are shown as the server sends them.
 *
 * The seller selector narrows the sums to one seller, like the chart cards: it starts at 「전체」 and is not saved.
 *
 * Both widths use the app's two tiers — the total on top, paid on the left and remaining on the right under it.
 * - Wide: two grid rows high (`minH: 2`), so the tiers get room; a stored one-row card grows to two on load.
 * - Narrow (`narrowTall`): the same tiers, tighter.
 */
export function PayoutCard({ sellers, editing, onRemove, narrow }: PayoutCardProps) {
  const useCase = useMemo(() => new SettlementUseCase(new SettlementRepositoryImpl()), []);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const load = useCallback(() => useCase.getMonthSummary(sellerId ?? undefined), [useCase, sellerId]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame
      title={spec.title}
      href={spec.href}
      editing={editing}
      onRemove={onRemove}
      action={<SellerSelect sellers={sellers} value={sellerId} onChange={setSellerId} />}
    >
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
            <div className="flex h-full flex-col justify-center gap-5 px-1">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-500">이번 달 지급 예정 총액</p>
                <p className="mt-1 truncate text-2xl font-bold text-gray-900">{formatMoney(total)}원</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-500">지금까지 지급된 금액</p>
                  <p className="mt-1 truncate text-lg font-bold text-gray-900">{formatMoney(paid)}원</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm text-gray-500">남은 지급 예정 금액</p>
                  <p className="mt-1 truncate text-lg font-bold text-gray-900">{formatMoney(remaining)}원</p>
                </div>
              </div>
            </div>
          )
        }
      </CardBody>
    </DashboardCardFrame>
  );
}
