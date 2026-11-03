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
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { toast } from '@/infrastructure/stores/toastStore';
import { formatChangedAt } from '@/domain/entities/PriceHistoryEntity';
import { parcelActionLabel, type PackingHistoryRow } from '@/domain/entities/PackingEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import { BoxChangeModal } from '@/app/dashboard/stock/packing/components/BoxChangeModal';
import { findOrCreateUnregisteredRecycledBox } from '@/app/dashboard/stock/packing/components/unregisteredRecycledBox';

/** `yyyy-MM-dd` from the local date — never the UTC date string (it shifts a day in KST). */
const toDateInput = (date: Date): string => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

interface DateRange {
  from: string;
  to: string;
}

/** 「포장 완료」 row = the only row that offers [상자 변경] (FEATURE_2611_06 / D15) */
const isPackedRow = (row: PackingHistoryRow): boolean =>
  row.fromStatus === 'PENDING' && row.toStatus === 'PACKED';

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
 * - Rows stay read only (D32): no row click, no edit / delete buttons. The one action (FEATURE_2611_06 / D18) =
 *   [상자 변경] on a 「포장 완료」 row (table cell and card) — changes that parcel's box with the packing screen's
 *   `BoxChangeModal` (reused, never copied — D17).
 * - Period = shortcut buttons only, no date inputs (D29).
 * - 「처리 시각」 prints the server's KST wall clock as is — no time zone math in this file (D40).
 * - Row order is the server's; never re-sorted here.
 */
export function PackingHistoryContainer() {
  const useCase = useMemo(() => new PackingUseCase(new PackingRepositoryImpl()), []);
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);

  const [range, setRange] = useState<DateRange>(() => recentDays(1));
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<PackingHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  /** Box list for the [상자 변경] dialog — loaded once after the first history load (empty on failure) */
  const [packages, setPackages] = useState<Package[]>([]);
  /** Row whose parcel box is being changed. `null` = dialog closed */
  const [boxTarget, setBoxTarget] = useState<PackingHistoryRow | null>(null);

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
      try {
        setPackages(await packageUseCase.getPackages());
      } catch {
        setPackages([]);
      }
    })();
  }, [load, packageUseCase]);

  /**
   * Changes the target parcel's box, then reloads with the period and the current search text as they are
   * (FEATURE_2611_06 / D17 · D20). Failure throws the server text — the dialog shows it and stays open.
   */
  const changeBox = async (box: Package) => {
    if (!boxTarget) return;
    try {
      await useCase.changeBox(boxTarget.parcelId, box.id);
    } catch (e) {
      throw new Error(extractErrorMessage(e, '상자를 바꾸지 못했습니다'));
    }
    setBoxTarget(null);
    await load({ range, keyword });
    toast.success(`상자를 바꿨습니다 — ${box.type}`);
  };

  const handlePick = async (packageId: number) => {
    const box = packages.find((pkg) => pkg.id === packageId);
    if (!box) return;
    await changeBox(box);
  };

  const handlePickUnregistered = async () => {
    const { box, created } = await findOrCreateUnregisteredRecycledBox(packages, packageUseCase);
    if (created) setPackages((previous) => [...previous, box]);
    await changeBox(box);
  };

  const handleCreate = async (request: CreatePackageRequest) => {
    let created: Package;
    try {
      created = await packageUseCase.createPackage(request);
    } catch (e) {
      throw new Error(extractErrorMessage(e, '상자를 등록하지 못했습니다'));
    }
    setPackages((previous) => [...previous, created]);
    await changeBox(created);
  };

  // Same button in the table cell and on the card (017-responsive: card keeps the row actions).
  const boxChangeButton = (row: PackingHistoryRow) => (
    <Button size="sm" variant="secondary" onClick={() => setBoxTarget(row)}>
      상자 변경
    </Button>
  );

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
          { label: '상자', value: row.boxName ?? '-' },
          { label: '처리자', value: row.changedBy ?? '-' },
        ]}
        actions={isPackedRow(row) ? boxChangeButton(row) : undefined}
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
                <th className="px-4 py-2">상자</th>
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
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {row.boxName ?? '-'}
                      {isPackedRow(row) && boxChangeButton(row)}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.changedBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCardSwitch>
      )}

      {boxTarget && (
        <BoxChangeModal
          packages={packages}
          selectedPackageId={boxTarget.boxPackageId}
          onClose={() => setBoxTarget(null)}
          onPick={handlePick}
          onPickUnregistered={handlePickUnregistered}
          onCreate={handleCreate}
        />
      )}
    </PageContainer>
  );
}
