'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { PriceHistoryUseCase } from '@/application/usecases/PriceHistoryUseCase';
import { PriceHistoryRepositoryImpl } from '@/infrastructure/repositories/PriceHistoryRepositoryImpl';
import { PLATFORMS } from '@/config/platforms';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { Seller } from '@/domain/entities/SellerEntity';
import {
  formatChangedAt,
  priceChangeReasonLabel,
  type PriceChangeRow,
} from '@/domain/entities/PriceHistoryEntity';
import { formatWon } from './RepricingTable';

/** `yyyy-MM-dd` (로컬 기준). 🔴 `toISOString()` 은 UTC 로 밀려 KST 에서 하루가 어긋난다. */
const toDateInput = (date: Date): string => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

interface DateRange {
  from: string;
  to: string;
}

/** 최근 n일(오늘 포함). n=1 이면 오늘 하루. */
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

/** 증감 — 오르면 빨강 `+`, 내리면 파랑 `−`(마이너스 기호는 하이픈이 아니다). */
const DiffCell = ({ diff }: { diff: number | null }) => {
  if (diff == null || diff === 0) return <span className="text-gray-500">—</span>;
  const amount = Math.abs(Math.round(diff)).toLocaleString('ko-KR');
  return (
    <span className={diff > 0 ? 'text-red-600' : 'text-blue-600'}>
      {diff > 0 ? '+' : '−'}
      {amount}원
    </span>
  );
};

interface RepricingHistoryTabProps {
  sellers: Seller[];
  /** 🔴 판매자·채널은 두 탭이 함께 쓰는 값이라 페이지가 소유한다(2609_43 / 03 Step 1) */
  sellerId: number | '';
  platform: string;
  onSellerChange: (value: number | '') => void;
  onPlatformChange: (value: string) => void;
  /** 조회 중 여부를 페이지에 알린다 — 탭 버튼을 잠그는 데 쓴다 */
  onBusyChange: (busy: boolean) => void;
}

/**
 * 「판매가 조정 내역」 탭 — 판매가가 언제 · 무엇 때문에 움직였는지의 기록(FEATURE_2609_43 / PLAN D9·D10).
 * File: src/app/dashboard/listings/repricing/components/RepricingHistoryTab.tsx
 *
 * 🔴 조회는 **이미 있던** `GET /api/admin/price-history` 를 쓴다(D10). 재가격 전용 API 를 새로 만들지 않는다 —
 *    이력은 2609_28 부터 계속 쌓이고 있었고 웹에 화면이 없었을 뿐이다.
 * 🔴 그 로그에는 매입 원가·수수료율 변경도 섞여 있다. 이 탭은 판매가만 다루므로
 *    `targetType=LISTING_SELLING` 을 **고정으로 보낸다.** 빼면 원가 행이 채널·옵션 빈칸으로 섞여 나온다.
 * 🔴 **읽기 전용**이다 — 체크박스·실행 버튼을 두지 않는다. 서버에도 쓰기 경로가 없다.
 * 🔴 「방금 처리함」 표시(경보 탭)와 대체 관계가 아니다: 저쪽은 새로고침하면 사라지는 즉시 확인용,
 *    여기는 새로고침 후에도 남는 기록이다.
 *
 * ⚠️ 서버가 필터 있는 조회를 500건에서 끊는다(`PriceHistoryServiceImpl.MAX_LIMIT`). 기간을 좁히는 것이
 *    유일한 대응이라 화면에 페이지 이동을 두지 않았다.
 */
export function RepricingHistoryTab({
  sellers,
  sellerId,
  platform,
  onSellerChange,
  onPlatformChange,
  onBusyChange,
}: RepricingHistoryTabProps) {
  const useCase = useMemo(() => new PriceHistoryUseCase(new PriceHistoryRepositoryImpl()), []);

  /** 기본 기간 = 오늘. 로그는 계속 자라기만 해서 기본을 넓게 잡으면 첫 조회부터 상한에 닿는다. */
  const [range, setRange] = useState<DateRange>(() => recentDays(1));
  const [rows, setRows] = useState<PriceChangeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (params: { sellerId: number | ''; platform: string; range: DateRange }) => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.search({
          // 🔴 판매가만. 이 한 줄이 빠지면 원가 변경 이력이 같이 내려온다.
          targetType: 'LISTING_SELLING',
          sellerId: params.sellerId === '' ? undefined : params.sellerId,
          platform: params.platform || undefined,
          from: params.range.from,
          to: params.range.to,
        });
        // 정렬은 서버가 한다(`createdAt desc, id desc`) — 화면에서 다시 정렬하지 않는다.
        setRows(list);
      } catch (e) {
        setError(extractErrorMessage(e, '판매가 조정 내역을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    },
    [useCase],
  );

  /**
   * 🔴 탭을 옮기면 이 컴포넌트가 다시 마운트되어 자기 조회를 새로 한다(03 함정 3 — 탭은 서버 축이다).
   * 마운트 시점의 공용 필터 값을 ref 에 잡아 둔다: 이 effect 가 필터마다 다시 돌면 [조회] 없이 자동 재조회가 된다.
   */
  const mountFilter = useRef({ sellerId, platform, range });

  useEffect(() => {
    // 인라인 async IIFE — effect 본문에서 동기 setState 를 호출하면 프로젝트 lint 가 막는다.
    void (async () => {
      await load(mountFilter.current);
    })();
  }, [load]);

  useEffect(() => {
    onBusyChange(isLoading);
  }, [isLoading, onBusyChange]);

  const search = (next: DateRange = range) => {
    setRange(next);
    void load({ sellerId, platform, range: next });
  };

  const isPresetActive = (preset: (typeof PRESETS)[number]) => {
    const presetRange = preset.range();
    return presetRange.from === range.from && presetRange.to === range.to;
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">판매자</label>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={sellerId}
              onChange={(e) => onSellerChange(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">전체 판매자</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sellerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">채널</label>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value)}
            >
              <option value="">전체 채널</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="history-from">
              시작
            </label>
            <input
              id="history-from"
              type="date"
              value={range.from}
              max={range.to || undefined}
              disabled={isLoading}
              onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="history-to">
              종료
            </label>
            <input
              id="history-to"
              type="date"
              value={range.to}
              min={range.from || undefined}
              disabled={isLoading}
              onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
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
          <Button type="button" onClick={() => search()} disabled={isLoading}>
            조회
          </Button>
        </div>
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
          <p className="py-6 text-center text-sm text-gray-500">
            이 기간에 판매가 조정 내역이 없습니다.
          </p>
        </Card>
      ) : (
        <div className="rounded-lg bg-white shadow list-table-scroll">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-100">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-2">변경 시각</th>
                <th className="px-4 py-2">상품(셀)</th>
                <th className="px-4 py-2">옵션</th>
                <th className="px-4 py-2">채널</th>
                <th className="px-4 py-2 text-right">이전가 → 새 가격</th>
                <th className="px-4 py-2 text-right">증감</th>
                <th className="px-4 py-2">사유</th>
                <th className="px-4 py-2">변경자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{formatChangedAt(row.createdAt)}</td>
                  <td className="px-4 py-2">{row.listingName ?? '—'}</td>
                  <td className="px-4 py-2">{row.optionName ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.platform ?? '—'}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <span className="text-gray-500">{formatWon(row.oldPrice)}</span>
                    <span className="px-1 text-gray-400">→</span>
                    <span className="font-medium">{formatWon(row.newPrice)}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <DiffCell diff={row.diff} />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {priceChangeReasonLabel(row.reason)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.createdBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
