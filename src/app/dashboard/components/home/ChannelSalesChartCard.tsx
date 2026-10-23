'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { channelLabel, formatMoney } from '@/domain/entities/SalesSummary';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { PeriodSelect } from './PeriodSelect';
import { SellerSelect } from './SellerSelect';
import { periodRange } from './dashboardLayout';
import { useCardData } from './useCardData';

interface ChannelSalesChartCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Seller list of the dashboard (FEATURE_2610_30 D37). */
  sellers: Seller[];
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.CHANNEL_SALES_CHART;

/**
 * G2 「채널별 매출」 (FEATURE_2610_29 D22) — one sales bar per channel, `/api/admin/sales/by-channel` as is (the
 * endpoint's rows and order). Bar colour = `--brand-main`.
 *
 * The seller selector (FEATURE_2610_30 D35 · D36 · D37) narrows the bars to that seller's channels; it starts at
 * 「전체」, is not saved, and stays when the period changes.
 */
export function ChannelSalesChartCard({ period, onPeriodChange, sellers, editing, onRemove }: ChannelSalesChartCardProps) {
  const useCase = useMemo(() => new SalesStatsUseCase(new SalesStatsRepositoryImpl()), []);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const load = useCallback(
    () => useCase.getChannelSales({ ...periodRange(period), sellerId: sellerId ?? undefined }),
    [useCase, period, sellerId]
  );
  const data = useCardData(load);

  return (
    <DashboardCardFrame
      title={spec.title}
      href={spec.href}
      editing={editing}
      onRemove={onRemove}
      action={
        <div className="flex items-center gap-1">
          <SellerSelect sellers={sellers} value={sellerId} onChange={setSellerId} />
          <PeriodSelect periods={spec.periods} value={period} onChange={onPeriodChange} />
        </div>
      }
    >
      <CardBody data={data}>
        {(rows) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows.map((row) => ({ label: channelLabel(row), grossSales: row.grossSales }))}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${formatMoney(Number(value))}원`, '매출']} />
              <Bar dataKey="grossSales" name="매출" fill="var(--brand-main)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
