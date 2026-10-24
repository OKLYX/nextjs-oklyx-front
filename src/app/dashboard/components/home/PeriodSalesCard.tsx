'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { channelLabel, formatMoney } from '@/domain/entities/SalesSummary';
import type { ChannelSales, SellerSales } from '@/domain/entities/SalesSummary';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import { CardBody, DashboardCardFrame, stopTap } from './DashboardCardFrame';
import { PeriodSelect } from './PeriodSelect';
import { periodRange } from './dashboardLayout';
import { useCardData } from './useCardData';

interface PeriodSalesCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  editing: boolean;
  onRemove: () => void;
}

/** One page of the card: a name and its two numbers (D25). */
interface SalesPage {
  label: string;
  grossSales: number;
  /** null = 「아직 모른다」 (a row without cost basis) — drawn as `—`, not 0. */
  profit: number | null;
}

type SalesRow = { grossSales: number; estNetProfit: number | null; costBasisReady: boolean };

const spec = DASHBOARD_CARD_SPECS.PERIOD_SALES;

/** 「매출」 sum and 「예상 순이익」 sum; the profit is null as soon as one row has none. */
function sumPage(label: string, rows: SalesRow[]): SalesPage {
  const unknown = rows.some((row) => !row.costBasisReady || row.estNetProfit === null);
  return {
    label,
    grossSales: rows.reduce((sum, row) => sum + row.grossSales, 0),
    profit: unknown ? null : rows.reduce((sum, row) => sum + (row.estNetProfit ?? 0), 0),
  };
}

/**
 * C5 「기간 매출」 (FEATURE_2610_29 D23 · D25 · D28).
 *
 * Step 1 pages = 「전체」 → each seller (`/summary` order). On a seller page with two or more channels the title row
 * ends with 「전체 | 채널」; 「채널」 switches to step 2 = that seller's channels (`/by-channel` order), 「전체」 goes back
 * to that seller's page. Changing the period goes back to the 「전체」 page. The page and step are not saved.
 */
export function PeriodSalesCard({ period, onPeriodChange, editing, onRemove }: PeriodSalesCardProps) {
  const useCase = useMemo(() => new SalesStatsUseCase(new SalesStatsRepositoryImpl()), []);
  const load = useCallback(async () => {
    const range = periodRange(period);
    const [sellers, channels] = await Promise.all([
      useCase.getSellerSummary(range),
      useCase.getChannelSales(range),
    ]);
    return { sellers, channels };
  }, [useCase, period]);
  const data = useCardData<{ sellers: SellerSales[]; channels: ChannelSales[] }>(load);
  const [sellerPage, setSellerPage] = useState(0);
  /** null = step 1; otherwise the channel page of step 2. */
  const [channelPage, setChannelPage] = useState<number | null>(null);

  const loaded = data.status === 'ready' ? data.data : null;
  const seller = loaded && sellerPage > 0 ? loaded.sellers[sellerPage - 1] : null;
  const sellerChannels = loaded && seller ? loaded.channels.filter((row) => row.sellerId === seller.sellerId) : [];

  const changePeriod = (next: DashboardPeriod) => {
    setSellerPage(0);
    setChannelPage(null);
    onPeriodChange(next);
  };

  const stepToggle = sellerChannels.length >= 2 && (
    <div className="flex overflow-hidden rounded border border-gray-300 text-xs max-md:flex-wrap" onClick={stopTap}>
      <button
        type="button"
        onClick={() => setChannelPage(null)}
        className={`px-2 py-0.5 ${channelPage === null ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}
      >
        전체
      </button>
      <button
        type="button"
        onClick={() => setChannelPage(0)}
        className={`px-2 py-0.5 ${channelPage !== null ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}
      >
        채널
      </button>
    </div>
  );

  return (
    <DashboardCardFrame
      title={spec.title}
      href={spec.href}
      editing={editing}
      onRemove={onRemove}
      action={
        <div className="flex items-center gap-1 max-md:flex-wrap">
          <PeriodSelect periods={spec.periods} value={period} onChange={changePeriod} />
          {stepToggle}
        </div>
      }
    >
      <CardBody data={data}>
        {({ sellers }) => {
          const pages: SalesPage[] =
            channelPage === null
              ? [sumPage('전체', sellers), ...sellers.map((row) => sumPage(row.sellerName, [row]))]
              : sellerChannels.map((row) => sumPage(channelLabel(row), [row]));
          const index = channelPage === null ? sellerPage : channelPage;
          const page = pages[index];
          const move = (next: number) => (channelPage === null ? setSellerPage(next) : setChannelPage(next));

          return (
            <div className="flex h-full flex-col justify-between gap-1">
              <p className="truncate text-xs text-gray-500">{page.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">매출</p>
                  <p className="truncate text-lg font-bold text-gray-900">{formatMoney(page.grossSales)}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">예상 순이익</p>
                  <p className="truncate text-lg font-bold text-gray-900">
                    {page.profit === null ? '—' : `${formatMoney(page.profit)}원`}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 max-md:flex-wrap" onClick={stopTap}>
                <button
                  type="button"
                  aria-label="이전"
                  disabled={index === 0}
                  onClick={() => move(index - 1)}
                  className="rounded p-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {pages.map((entry, dot) => (
                    <span
                      key={`${entry.label}-${dot}`}
                      className={`h-1.5 w-1.5 rounded-full ${dot === index ? 'bg-gray-700' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="다음"
                  disabled={index === pages.length - 1}
                  onClick={() => move(index + 1)}
                  className="rounded p-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        }}
      </CardBody>
    </DashboardCardFrame>
  );
}
