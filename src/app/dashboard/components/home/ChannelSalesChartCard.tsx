'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { channelLabel, formatMoney, platformLabel, type ChannelSales } from '@/domain/entities/SalesSummary';
import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { CardBody, DashboardCardFrame, stopTap } from './DashboardCardFrame';
import { PeriodSelect } from './PeriodSelect';
import { SellerSelect } from './SellerSelect';
import { PREVIOUS_PERIOD_LABELS, periodRange, previousPeriodRange } from './dashboardLayout';
import { useCardData } from './useCardData';

interface ChannelSalesChartCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Seller list of the dashboard (FEATURE_2610_30 D37). */
  sellers: Seller[];
  editing: boolean;
  onRemove: () => void;
}

/** 「마켓」 = accounts grouped under their market · 「계정」 = one flat line per account. Not saved. */
type GroupMode = 'MARKET' | 'ACCOUNT';

interface ChannelSalesData {
  rows: ChannelSales[];
  /** Same seller, the period right before — null when that call failed (no change is shown). */
  previous: ChannelSales[] | null;
  /** Every account of the tenant — null when that call failed (no 「매출 없는 채널」 line). */
  accounts: MarketplaceAccount[] | null;
}

const spec = DASHBOARD_CARD_SPECS.CHANNEL_SALES_CHART;

/** Line shape of the list — fixed, the number of lines comes from the measured list height. */
const LINE_HEIGHT_PX = 22;
const NAME_WIDTH_PX = 120;
/** Below this body height the share bar and its legend are dropped so channel lines still fit (phone · 1-row card). */
const COMPACT_BELOW_HEIGHT_PX = 150;
/** Below this body width the per-line bar is dropped — names and numbers keep the room. */
const BAR_FROM_WIDTH_PX = 440;
/** Below this body width the change column is dropped. */
const CHANGE_FROM_WIDTH_PX = 300;

/** Which optional parts fit the measured body. */
interface Fit {
  bar: boolean;
  change: boolean;
}

/** Colours of the share bar, in sales order (brand utilities first — dark mode remaps them). */
const GROUP_COLORS = ['bg-brand', 'bg-brand-teal', 'bg-brand-green', 'bg-brand-slate', 'bg-violet-400', 'bg-pink-400'];
const OTHER_COLOR = 'bg-gray-400';
/** Accounts inside one market share its colour, lighter down the list. */
const ACCOUNT_OPACITY = [1, 0.7, 0.5, 0.35];

/** A colour for the `index`-th group; groups past the palette share the grey. */
const colorAt = (index: number) => GROUP_COLORS[index] ?? OTHER_COLOR;

/** Share of `value` in `total` as 「79.8%」. */
const formatShare = (value: number, total: number) => `${total > 0 ? ((Math.max(value, 0) / total) * 100).toFixed(1) : '0.0'}%`;

/** Change against the previous period in percent; null = nothing to compare (no previous sales). */
function changePct(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** 「+12%」 green · 「−4%」 red · 「0%」 grey; empty when there is nothing to compare. */
function ChangeText({ pct, digits = 0 }: { pct: number | null; digits?: number }) {
  if (pct === null) return null;
  const rounded = Number(pct.toFixed(digits));
  if (rounded === 0) return <span className="text-gray-500">0%</span>;
  return rounded > 0 ? (
    <span className="text-green-600">+{rounded.toFixed(digits)}%</span>
  ) : (
    <span className="text-red-600">−{Math.abs(rounded).toFixed(digits)}%</span>
  );
}

interface AccountLine {
  kind: 'account';
  row: ChannelSales;
  /** Tailwind background class of the dot and bar. */
  color: string;
  opacity: number;
  /** Market mode indents the account under its market header. */
  indent: boolean;
}

interface MarketLine {
  kind: 'market';
  platform: string;
  sales: number;
  previous: number | undefined;
  accountCount: number;
  color: string;
}

type Line = AccountLine | MarketLine;

/** One share-bar segment and legend entry. */
interface Segment {
  key: string;
  label: string;
  sales: number;
  color: string;
}

/** Lines, bar segments and totals of the loaded data in the chosen mode — pure, no React. */
function buildView(data: ChannelSalesData, mode: GroupMode, sellerId: number | null) {
  const selling = data.rows.filter((row) => row.grossSales > 0);
  const total = data.rows.reduce((sum, row) => sum + row.grossSales, 0);
  const previousByAccount = new Map((data.previous ?? []).map((row) => [row.accountId, row.grossSales]));
  const previousTotal = data.previous === null ? null : data.previous.reduce((sum, row) => sum + row.grossSales, 0);

  const lines: Line[] = [];
  const segments: Segment[] = [];
  if (mode === 'MARKET') {
    // The rows come sorted by sales from the server, so first appearance = market order.
    const markets = new Map<string, ChannelSales[]>();
    selling.forEach((row) => markets.set(row.platform, [...(markets.get(row.platform) ?? []), row]));
    [...markets.entries()].forEach(([platform, rows], index) => {
      const color = colorAt(index);
      const sales = rows.reduce((sum, row) => sum + row.grossSales, 0);
      const previous =
        data.previous === null
          ? undefined
          : data.previous.filter((row) => row.platform === platform).reduce((sum, row) => sum + row.grossSales, 0);
      segments.push({ key: platform, label: platformLabel(platform), sales, color });
      lines.push({ kind: 'market', platform, sales, previous, accountCount: rows.length, color });
      rows.forEach((row, i) =>
        lines.push({ kind: 'account', row, color, opacity: ACCOUNT_OPACITY[i] ?? ACCOUNT_OPACITY[ACCOUNT_OPACITY.length - 1], indent: true })
      );
    });
  } else {
    selling.forEach((row, index) => {
      const color = colorAt(index);
      segments.push({ key: String(row.accountId), label: channelLabel(row), sales: row.grossSales, color });
      lines.push({ kind: 'account', row, color, opacity: 1, indent: false });
    });
  }

  const sellingIds = new Set(selling.map((row) => row.accountId));
  const idle =
    data.accounts?.filter(
      (account) => account.isActive && (sellerId === null || account.sellerId === sellerId) && !sellingIds.has(account.id)
    ) ?? [];

  return { total, previousTotal, previousByAccount, lines, segments, idle };
}


/** Segmented 「마켓 | 계정」 switch in the title row. A tap on it does not open the card's screen. */
function GroupModeSwitch({ value, onChange }: { value: GroupMode; onChange: (mode: GroupMode) => void }) {
  const options: { mode: GroupMode; label: string }[] = [
    { mode: 'MARKET', label: '마켓' },
    { mode: 'ACCOUNT', label: '계정' },
  ];
  return (
    <div role="group" aria-label="묶는 방식" onClick={stopTap} className="flex rounded border border-gray-300 text-sm">
      {options.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={`px-2 py-1 first:rounded-l last:rounded-r ${
            value === mode ? 'bg-gray-100 font-medium text-gray-900' : 'bg-white text-gray-500 hover:text-gray-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Right-hand columns shared by both line kinds so the amounts line up. */
function ValueColumns({ sales, total, pct, fit, strong }: { sales: number; total: number; pct: number | null; fit: Fit; strong?: boolean }) {
  return (
    <>
      <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>{formatMoney(sales)}원</span>
      <span className="w-12 shrink-0 text-right tabular-nums text-gray-500">{formatShare(sales, total)}</span>
      {fit.change && (
        <span className="w-11 shrink-0 text-right tabular-nums">
          <ChangeText pct={pct} />
        </span>
      )}
    </>
  );
}

function MarketRow({ line, total, fit }: { line: MarketLine; total: number; fit: Fit }) {
  const label = platformLabel(line.platform);
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ height: LINE_HEIGHT_PX }}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white ${line.color}`}>
          {label.charAt(0)}
        </span>
        <span className="truncate font-medium text-gray-900">{label}</span>
        <span className="shrink-0 text-gray-500">계정 {line.accountCount}개</span>
      </div>
      <ValueColumns sales={line.sales} total={total} pct={changePct(line.sales, line.previous)} fit={fit} strong />
    </div>
  );
}

function AccountRow({
  line,
  total,
  previous,
  fit,
}: {
  line: AccountLine;
  total: number;
  previous: number | undefined;
  fit: Fit;
}) {
  const { row } = line;
  const name = line.indent ? row.accountAlias?.trim() || `채널 #${row.accountId}` : channelLabel(row);
  const ratio = total > 0 ? Math.max(row.grossSales, 0) / total : 0;
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ height: LINE_HEIGHT_PX }}>
      <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${line.indent ? 'pl-5' : ''}`}>
        <span className={`h-2 w-2 shrink-0 rounded-sm ${line.color}`} style={{ opacity: line.opacity }} />
        <span
          className={`truncate text-gray-700 ${fit.bar ? 'shrink-0' : 'min-w-0 flex-1'}`}
          style={fit.bar ? { width: NAME_WIDTH_PX } : undefined}
          title={channelLabel(row)}
        >
          {name}
        </span>
        {fit.bar && (
          <div className="h-1.5 min-w-0 flex-1 rounded-full bg-gray-100">
            <div className={`h-full rounded-full ${line.color}`} style={{ width: `${ratio * 100}%`, opacity: line.opacity }} />
          </div>
        )}
      </div>
      <ValueColumns sales={row.grossSales} total={total} pct={changePct(row.grossSales, previous)} fit={fit} />
    </div>
  );
}

/** Content size of the element, re-measured when the card is resized (0 × 0 before the first measure). */
function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function ChannelSalesView({
  data,
  mode,
  sellerId,
  period,
}: {
  data: ChannelSalesData;
  mode: GroupMode;
  sellerId: number | null;
  period: DashboardPeriod;
}) {
  const view = useMemo(() => buildView(data, mode, sellerId), [data, mode, sellerId]);
  const [bodyRef, body] = useElementSize();
  const [listRef, list] = useElementSize();

  if (view.lines.length === 0 && view.idle.length === 0) {
    return <p className="flex h-full items-center justify-center text-xs text-gray-500">이 기간 매출이 없습니다.</p>;
  }

  const compact = body.height > 0 && body.height < COMPACT_BELOW_HEIGHT_PX;
  const fit: Fit = { bar: body.width >= BAR_FROM_WIDTH_PX, change: body.width >= CHANGE_FROM_WIDTH_PX };
  // A short card in market mode lists only the market lines — one line per market says more than a header plus one
  // account. A market header that fits without its accounts still shows the market total; cut accounts fold below.
  const marketsOnly = compact && mode === 'MARKET';
  const candidates = marketsOnly ? view.lines.filter((line) => line.kind === 'market') : view.lines;
  const shown = candidates.slice(0, Math.floor(list.height / LINE_HEIGHT_PX));
  const shownAccounts = new Set(shown.flatMap((line) => (line.kind === 'account' ? [line.row.accountId] : [])));
  const shownMarkets = new Set(shown.flatMap((line) => (line.kind === 'market' ? [line.platform] : [])));
  const hidden = view.lines.flatMap((line) =>
    line.kind === 'account' &&
    !shownAccounts.has(line.row.accountId) &&
    !(marketsOnly && shownMarkets.has(line.row.platform))
      ? [line.row]
      : []
  );
  const totalPct = view.previousTotal === null ? null : changePct(view.total, view.previousTotal);
  const legend = view.segments.slice(0, 3);
  const footer = [
    hidden.length > 0 && `외 ${hidden.length}개 채널 · ${formatMoney(hidden.reduce((sum, row) => sum + row.grossSales, 0))}원`,
    view.idle.length > 0 &&
      `매출 없는 채널 ${view.idle.length}개 (${view.idle.map((account) => channelLabel({ ...account, accountId: account.id })).join(', ')})`,
  ].filter(Boolean) as string[];

  return (
    <div ref={bodyRef} className="flex h-full flex-col overflow-hidden">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2 overflow-hidden">
        <span className={`whitespace-nowrap font-semibold tabular-nums text-gray-900 ${compact ? 'text-base' : 'text-xl'}`}>{formatMoney(view.total)}원</span>
        {totalPct !== null && (
          <span className="flex min-w-0 items-baseline gap-1 text-xs">
            <span className="font-medium tabular-nums">
              <ChangeText pct={totalPct} digits={1} />
            </span>
            <span className="truncate text-gray-500">{PREVIOUS_PERIOD_LABELS[period]}</span>
          </span>
        )}
        {view.previousTotal === 0 && view.total > 0 && <span className="shrink-0 text-xs text-gray-500">직전 기간 매출 없음</span>}
      </div>

      {!compact && view.segments.length > 0 && (
        <>
          <div className="mt-1.5 flex h-2 shrink-0 gap-0.5 overflow-hidden rounded-full bg-gray-100">
            {view.segments.map((segment) => (
              <div
                key={segment.key}
                className={segment.color}
                style={{ width: `${view.total > 0 ? (segment.sales / view.total) * 100 : 0}%` }}
                title={`${segment.label} ${formatMoney(segment.sales)}원`}
              />
            ))}
          </div>
          <p className="mt-1 shrink-0 truncate text-xs text-gray-500">
            {legend.map((segment) => `${segment.label} ${formatShare(segment.sales, view.total)}`).join(' · ')}
            {view.segments.length > legend.length && ` 외 ${view.segments.length - legend.length}`}
          </p>
        </>
      )}

      <div
        ref={listRef}
        className={`min-h-0 flex-1 overflow-hidden ${compact ? '' : 'mt-1.5 border-t border-gray-200 pt-1'}`}
      >
        {shown.map((line) =>
          line.kind === 'market' ? (
            <MarketRow key={`m-${line.platform}`} line={line} total={view.total} fit={fit} />
          ) : (
            <AccountRow
              key={line.row.accountId}
              line={line}
              total={view.total}
              previous={view.previousByAccount.get(line.row.accountId)}
              fit={fit}
            />
          )
        )}
      </div>

      {footer.length > 0 && (
        <p
          className={`shrink-0 truncate text-xs text-gray-500 ${compact ? '' : 'border-t border-gray-200 pt-1'}`}
          title={footer.join(' · ')}
        >
          {footer.join(' · ')}
        </p>
      )}
    </div>
  );
}

/**
 * G2 「채널별 매출」 (FEATURE_2610_29 D22) — total sales with the change against the period right before, a share bar
 * with the top three groups, then the channel lines grouped by market (or flat by account), each with amount · share ·
 * change. Lines that do not fit the card fold into 「외 K개 채널」, and active channels with no sales are named in the
 * same last line.
 *
 * Data: `/api/admin/sales/by-channel` for the period and for `previousPeriodRange`, plus the account list for the
 * no-sales channels — the last two are optional (a failure hides only their part).
 *
 * The seller selector (FEATURE_2610_30 D35 · D36 · D37) narrows everything to that seller's channels; it starts at
 * 「전체」, is not saved, and stays when the period changes. The 「마켓 | 계정」 switch is not saved either.
 */
export function ChannelSalesChartCard({ period, onPeriodChange, sellers, editing, onRemove }: ChannelSalesChartCardProps) {
  const salesUseCase = useMemo(() => new SalesStatsUseCase(new SalesStatsRepositoryImpl()), []);
  const accountUseCase = useMemo(() => new MarketplaceAccountUseCase(new MarketplaceAccountRepositoryImpl()), []);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const [mode, setMode] = useState<GroupMode>('MARKET');
  const load = useCallback(async (): Promise<ChannelSalesData> => {
    const seller = sellerId ?? undefined;
    const [rows, previous, accounts] = await Promise.all([
      salesUseCase.getChannelSales({ ...periodRange(period), sellerId: seller }),
      salesUseCase.getChannelSales({ ...previousPeriodRange(period), sellerId: seller }).catch(() => null),
      accountUseCase.getAll().catch(() => null),
    ]);
    return { rows, previous, accounts };
  }, [salesUseCase, accountUseCase, period, sellerId]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame
      title={spec.title}
      href={spec.href}
      editing={editing}
      onRemove={onRemove}
      action={
        <div className="flex items-center gap-1 max-md:flex-wrap">
          <GroupModeSwitch value={mode} onChange={setMode} />
          <SellerSelect sellers={sellers} value={sellerId} onChange={setSellerId} />
          <PeriodSelect periods={spec.periods} value={period} onChange={onPeriodChange} />
        </div>
      }
    >
      <CardBody data={data}>
        {(value) => <ChannelSalesView data={value} mode={mode} sellerId={sellerId} period={period} />}
      </CardBody>
    </DashboardCardFrame>
  );
}
