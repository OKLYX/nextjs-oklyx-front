'use client';

import { useCallback, useMemo } from 'react';
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { formatMoney } from '@/domain/entities/SalesSummary';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { PeriodSelect } from './PeriodSelect';
import { periodRange } from './dashboardLayout';
import { useCardData } from './useCardData';

interface DailySalesChartCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.DAILY_SALES_CHART;

/** `yyyy-MM-dd` → `M/D` axis label. */
function dayLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

/**
 * G1 「날짜별 매출 · 주문 수」 (FEATURE_2610_29 D13 · D22) — a sales bar and an order-count line per sale date, and the
 * period total above the chart. Colours = the brand tokens (`--brand-main` bar · `--brand-teal` line).
 */
export function DailySalesChartCard({ period, onPeriodChange, editing, onRemove }: DailySalesChartCardProps) {
  const useCase = useMemo(() => new SalesStatsUseCase(new SalesStatsRepositoryImpl()), []);
  const load = useCallback(() => useCase.getDailySales(periodRange(period)), [useCase, period]);
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
          <div className="flex h-full flex-col gap-1">
            <p className="text-sm text-gray-700">
              합계 <span className="font-bold text-gray-900">{formatMoney(rows.reduce((sum, row) => sum + row.grossSales, 0))}원</span>
            </p>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows.map((row) => ({ ...row, label: dayLabel(row.date) }))}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="sales" width={64} tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMoney(value)} />
                  <YAxis yAxisId="orders" orientation="right" width={32} allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === '매출' ? [`${formatMoney(Number(value))}원`, name] : [`${Number(value)}건`, name]
                    }
                  />
                  <Bar yAxisId="sales" dataKey="grossSales" name="매출" fill="var(--brand-main)" />
                  <Line yAxisId="orders" dataKey="orderCount" name="주문 수" stroke="var(--brand-teal)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
