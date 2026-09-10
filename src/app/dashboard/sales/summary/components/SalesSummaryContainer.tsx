'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import type { ChannelSales, SellerSales } from '@/domain/entities/SalesSummary';
import { SalesTabs } from '../../components/SalesTabs';
import { PeriodFilter, currentMonthRange } from '../../components/PeriodFilter';
import { SellerSummaryTable } from './SellerSummaryTable';

/**
 * 매출 조회 화면의 상태 소유자 (FEATURE_2609_30 / 04 Step 3).
 *
 * 소유 상태 = 기간(`from`/`to`) · 판매자 행 · 펼친 판매자 1명 + 그 채널 행.
 * 🔴 기간과 펼침은 <b>URL 에 넣지 않는다</b>(04 Step 2-1) — 공유·복원 대상이 아니고,
 * 두 탭이 각자 자기 기간을 갖는다.
 *
 * ⚠️ 정산 배치·금액 확인은 이 화면이 아니다(PLAN D2). 채널 행의 `[정산 내역 →]` 이 유일한 진입점이다.
 */
export function SalesSummaryContainer() {
  const router = useRouter();
  const salesStatsUseCase = useMemo(
    () => new SalesStatsUseCase(new SalesStatsRepositoryImpl()),
    []
  );

  const initialRange = useMemo(() => currentMonthRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const [rows, setRows] = useState<SellerSales[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // 같은 조건으로 다시 부르게 하는 카운터([다시 시도]) — 기간이 그대로면 이펙트가 안 돌기 때문.
  const [reloadTick, setReloadTick] = useState(0);

  const [expandedSellerId, setExpandedSellerId] = useState<number | null>(null);
  const [channels, setChannels] = useState<ChannelSales[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState('');

  // 프리셋을 빠르게 연타하면 응답이 역순으로 도착할 수 있다 — 마지막 요청의 결과만 반영한다.
  const requestIdRef = useRef(0);

  // ⚠️ 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가 막는다
  // — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      const result = await salesStatsUseCase.getSellerSummary({ from, to });
      if (requestId !== requestIdRef.current) return;
      setRows(result);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError('매출 조회에 실패했습니다.');
      setRows([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [salesStatsUseCase, from, to]);

  // `reloadTick` 은 [다시 시도] 전용 — 조건이 그대로면 이펙트가 안 돌기 때문에 카운터로 강제한다.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, reloadTick]);

  const handlePeriodChange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    // 펼쳐둔 채널 행은 이전 기간의 값이다 — 접어서 기간이 섞이지 않게 한다.
    setExpandedSellerId(null);
    setChannels([]);
    setChannelsError('');
  }, []);

  const handleToggle = useCallback(
    async (sellerId: number) => {
      if (expandedSellerId === sellerId) {
        setExpandedSellerId(null);
        return;
      }
      setExpandedSellerId(sellerId);
      setChannels([]);
      setChannelsError('');
      setChannelsLoading(true);
      try {
        setChannels(await salesStatsUseCase.getChannelSales({ from, to, sellerId }));
      } catch {
        setChannelsError('채널별 매출 조회에 실패했습니다.');
      } finally {
        setChannelsLoading(false);
      }
    },
    [salesStatsUseCase, expandedSellerId, from, to]
  );

  // 05 머지 전에는 404 가 정상이다(라우트만 먼저 확정해 둔다).
  const openSettlement = useCallback(
    (accountId: number) => router.push(`${ROUTES.SETTLEMENT_PAYOUTS}?accountId=${accountId}`),
    [router]
  );
  const openUnreconciled = useCallback(
    (sellerId: number) =>
      router.push(`${ROUTES.SETTLEMENT_PAYOUTS}?sellerId=${sellerId}&reconStatus=UNRECONCILED`),
    [router]
  );

  const invalidRange = Boolean(from && to && from > to);
  // 한 행이라도 원가 스냅샷이 없으면 안내를 띄운다 — 순이익 칸의 `—` 가 무슨 뜻인지 화면에 쓴다(D15).
  const showCostBasisNotice = rows.some((row) => !row.costBasisReady);

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">매출</h1>
        <p className="text-sm text-gray-500">
          판매일 기준 집계입니다. 실제 입금(정산)은 채널을 펼쳐 확인하세요.
        </p>
      </div>

      <SalesTabs />

      <PeriodFilter from={from} to={to} isLoading={isLoading} onChange={handlePeriodChange} />

      {invalidRange && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          시작일이 종료일보다 뒤입니다.
        </div>
      )}

      {showCostBasisNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          순이익 추정치는 상품 단가와 비용(택배비, 상자비 등)이 모두 작성 완료되어야 표시가능합니다.
        </div>
      )}

      <SellerSummaryTable
        rows={rows}
        loading={isLoading}
        error={error}
        expandedSellerId={expandedSellerId}
        channels={channels}
        channelsLoading={channelsLoading}
        channelsError={channelsError}
        onToggle={handleToggle}
        onRetry={() => setReloadTick((tick) => tick + 1)}
        onOpenSettlement={openSettlement}
        onOpenUnreconciled={openUnreconciled}
      />
    </PageContainer>
  );
}
