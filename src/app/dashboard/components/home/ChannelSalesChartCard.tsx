'use client';

import { useCallback, useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { channelLabel, formatMoney } from '@/domain/entities/SalesSummary';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { PeriodSelect } from './PeriodSelect';
import { periodRange } from './dashboardLayout';
import { useCardData } from './useCardData';

interface ChannelSalesChartCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.CHANNEL_SALES_CHART;

/**
 * G2 「채널별 매출」 (FEATURE_2610_29 D22) — one sales bar per channel, `/api/admin/sales/by-channel` as is (the
 * endpoint's rows and order). Bar colour = `--brand-main`.
 */
export function ChannelSalesChartCard({ period, onPeriodChange, editing, onRemove }: ChannelSalesChartCardProps) {
  const useCase = useMemo(() => new SalesStatsUseCase(new SalesStatsRepositoryImpl()), []);
  const load = useCallback(() => useCase.getChannelSales(periodRange(period)), [useCase, period]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame
      title={spec.title}
      href={spec.href}
      editing={editing}
      onRemove={onRemove}
      action={<PeriodSelect periods={spec.periods} value={period} onChange={onPeriodChange} />}
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
