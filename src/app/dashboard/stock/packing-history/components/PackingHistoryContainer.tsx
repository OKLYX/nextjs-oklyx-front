'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { PackingUseCase } from '@/application/usecases/PackingUseCase';
import { PackingRepositoryImpl } from '@/infrastructure/repositories/PackingRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { formatChangedAt } from '@/domain/entities/PriceHistoryEntity';
import { parcelActionLabel, type PackingHistoryRow } from '@/domain/entities/PackingEntity';

/** `yyyy-MM-dd` from the local date — never the UTC date string (it shifts a day in KST). */
const toDateInput = (date: Date): string => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

interface DateRange {
  from: string;
  to: string;
}

/** Last n days including today. n=1 = today only. */
const recentDays = (days: number): DateRange => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  return { from: toDateInput(start), to: toDateInput(today) };
};

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: '오늘', range: () => recentDays(1) },
  { label: '최근 7일', range: () => recentDays(7) },
  { label: '최근 30일', range: () => recentDays(30) },
];

/**
 * 「포장 이력」 screen — parcel status change rows (packed · marked unused · restored), newest first
 * (FEATURE_2611_03 / PLAN D19 · D30).
 * File: src/app/dashboard/stock/packing-history/components/PackingHistoryContainer.tsx
 *
 * - Read only (D32): no row click, no edit / delete buttons. The server has no write path here.
 * - Period = shortcut buttons only, no date inputs (D29).
 * - 「처리 시각」 prints the server's KST wall clock as is — no time zone math in this file (D40).
 * - Row order is the server's; never re-sorted here.
 */
export function PackingHistoryContainer() {
  const useCase = useMemo(() => new PackingUseCase(new PackingRepositoryImpl()), []);

  const [range, setRange] = useState<DateRange>(() => recentDays(1));
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<PackingHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (params: { range: DateRange; keyword: string }) => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.history({
          from: params.range.from,
          to: params.range.to,
          keyword: params.keyword,
        });
        setRows(list);
      } catch (e) {
        setError(extractErrorMessage(e, '포장 이력을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    },
    [useCase],
  );

  // First load = today, empty keyword.
  const initialQuery = useRef({ range, keyword });

  useEffect(() => {
    // Inline async IIFE — a sync setState in the effect body is blocked by the project lint.
    void (async () => {
      await load(initialQuery.current);
    })();
  }, [load]);

  const search = (next: DateRange = range) => {
    setRange(next);
    void load({ range: next, keyword });
  };

  const isPresetActive = (preset: (typeof PRESETS)[number]) => {
    const presetRange = preset.range();
    return presetRange.from === range.from && presetRange.to === range.to;
  };

  // Narrow-screen cards (FEATURE_2610_31 D22): every table column as label · value.
  const renderCards = () =>
    rows.map((row) => (
      <DataCard
        key={row.id}
        fields={[
          { label: '처리 시각', value: formatChangedAt(row.changedAt) },
          { label: '송장번호', value: row.invoiceNumber },
          { label: '택배사', value: row.carrierName ?? '-' },
          { label: '주문번호', value: row.externalOrderId },
          { label: '판매자', value: row.sellerName ?? '-' },
          { label: '동작', value: parcelActionLabel(row.fromStatus, row.toStatus) },
          { label: '처리자', value: row.changedBy ?? '-' },
        ]}
      />
    ));

  return (
    <PageContainer title="포장 이력">
      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <div className="flex items-center gap-2 pb-0.5 max-md:flex-wrap">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isLoading}
                onClick={() => search(preset.range())}
                className={`rounded border px-2 py-1.5 text-sm disabled:opacity-50 ${
                  isPresetActive(preset)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="packing-history-keyword">
              검색
            </label>
            <Input
              id="packing-history-keyword"
              size="sm"
              value={keyword}
              placeholder="송장번호 또는 주문번호"
              disabled={isLoading}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            조회
          </Button>
        </form>
      </Card>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <Card>
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-gray-500">이 기간에 포장 이력이 없습니다.</p>
        </Card>
      ) : (
        <DataCardSwitch placement="page" renderCards={renderCards} className="rounded-lg bg-white shadow list-table-scroll">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-100">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-2">처리 시각</th>
                <th className="px-4 py-2">송장번호</th>
                <th className="px-4 py-2">택배사</th>
                <th className="px-4 py-2">주문번호</th>
                <th className="px-4 py-2">판매자</th>
                <th className="px-4 py-2">동작</th>
                <th className="px-4 py-2">처리자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{formatChangedAt(row.changedAt)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.invoiceNumber}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.carrierName ?? '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.externalOrderId}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.sellerName ?? '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {parcelActionLabel(row.fromStatus, row.toStatus)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.changedBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCardSwitch>
      )}
    </PageContainer>
  );
}
