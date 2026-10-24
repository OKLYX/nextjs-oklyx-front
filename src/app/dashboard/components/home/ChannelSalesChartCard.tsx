'use client';

import { useCallback, useMemo, useState } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { channelLabel, formatMoney, type ChannelSales } from '@/domain/entities/SalesSummary';
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
  /** Channel rows shown before the rest fold into one line (`channelChartRows`, DASHBOARD_CARDS D44). */
  rows: number;
  /** Below 768px — the name column narrows to 96px. */
  narrow: boolean;
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.CHANNEL_SALES_CHART;

/** Row shape of the channel lines (DASHBOARD_CARDS D42) — fixed, never shrunk by the channel count. */
const ROW_HEIGHT_PX = 22;
const FOLD_HEIGHT_PX = 16;
const BAR_HEIGHT_PX = 10;
const NAME_WIDTH_PX = 120;
const NARROW_NAME_WIDTH_PX = 96;

/** One channel line: name · bar (sales ÷ the top channel's sales) · amount. */
function ChannelLine({ row, top, nameWidth }: { row: ChannelSales; top: number; nameWidth: number }) {
  const ratio = top > 0 ? Math.max(row.grossSales, 0) / top : 0;
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ height: ROW_HEIGHT_PX }}>
      <span className="shrink-0 truncate text-gray-700" style={{ width: nameWidth }} title={channelLabel(row)}>
        {channelLabel(row)}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="rounded-[2px]"
          style={{ width: `${ratio * 100}%`, height: BAR_HEIGHT_PX, background: 'var(--brand-main)' }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-gray-900">{formatMoney(row.grossSales)}원</span>
    </div>
  );
}

/**
 * The top `limit` channels as lines, the rest folded into 「외 K개 채널 · 합계원」 (DASHBOARD_CARDS D41). The rows
 * come sorted by sales from the server — no re-sort here.
 */
function ChannelLines({ rows, limit, nameWidth }: { rows: ChannelSales[]; limit: number; nameWidth: number }) {
  if (rows.length === 0) {
    return <p className="flex h-full items-center justify-center text-xs text-gray-500">이 기간 매출이 없습니다.</p>;
  }
  const shown = rows.slice(0, limit);
  const hidden = rows.slice(limit);
  const top = shown[0].grossSales;
  return (
    <div className="h-full overflow-hidden">
      {shown.map((row) => (
        <ChannelLine key={row.accountId} row={row} top={top} nameWidth={nameWidth} />
      ))}
      {hidden.length > 0 && (
        <p className="text-xs text-gray-500" style={{ height: FOLD_HEIGHT_PX, lineHeight: `${FOLD_HEIGHT_PX}px` }}>
          외 {hidden.length}개 채널 · {formatMoney(hidden.reduce((sum, row) => sum + row.grossSales, 0))}원
        </p>
      )}
    </div>
  );
}

/**
 * G2 「채널별 매출」 (FEATURE_2610_29 D22) — `/api/admin/sales/by-channel` as is (the endpoint's rows and order).
 * The top `rows` channels are drawn as name · bar · amount lines with a fixed 12px font; the rest fold into one
 * 「외 K개」 line (DASHBOARD_CARDS D41 · D42). Bar colour = `--brand-main`.
 *
 * The seller selector (FEATURE_2610_30 D35 · D36 · D37) narrows the bars to that seller's channels; it starts at
 * 「전체」, is not saved, and stays when the period changes.
 */
export function ChannelSalesChartCard({ period, onPeriodChange, sellers, rows: rowLimit, narrow, editing, onRemove }: ChannelSalesChartCardProps) {
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
        <div className="flex items-center gap-1 max-md:flex-wrap">
          <SellerSelect sellers={sellers} value={sellerId} onChange={setSellerId} />
          <PeriodSelect periods={spec.periods} value={period} onChange={onPeriodChange} />
        </div>
      }
    >
      <CardBody data={data}>
        {(rows) => (
          <ChannelLines rows={rows} limit={rowLimit} nameWidth={narrow ? NARROW_NAME_WIDTH_PX : NAME_WIDTH_PX} />
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
