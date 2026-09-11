'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import type { ChannelSales, SellerSales } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import { SalesTabs } from '../../components/SalesTabs';
import { PeriodFilter, currentMonthRange } from '../../components/PeriodFilter';
import { SellerSummaryTable } from './SellerSummaryTable';

/**
 * 조회 기간이 한 달보다 짧은가 (PLAN 2609_33 D4-2).
 *
 * 🔴 <b>날짜만 보고 판정한다</b> — 매출·임계를 비교하지 않는다(부과 판정은 서버 몫, D2).
 * 같은 달 안이면서 그 달 전체(1일~말일)가 아니면 짧은 기간이다.
 */
const isShorterThanMonth = (from: string, to: string): boolean => {
  if (!from || !to || from > to) return false;
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  if (fromYear !== toYear || fromMonth !== toMonth) return false;
  // `Date.UTC(year, month, 0)` = 그 달의 말일(month 가 1-based 라 0-based 로는 다음 달이다).
  const lastDay = new Date(Date.UTC(toYear, toMonth, 0)).getUTCDate();
  return fromDay !== 1 || toDay !== lastDay;
};

/**
 * 매출 조회 화면의 상태 소유자 (FEATURE_2609_30 / 04 Step 3).
 *
 * 소유 상태 = 기간(`from`/`to`) · 판매자 행 · 펼친 판매자 1명 + 그 채널 행.
 * 🔴 기간과 펼침은 <b>URL 에 넣지 않는다</b>(04 Step 2-1) — 공유·복원 대상이 아니고,
 * 두 탭이 각자 자기 기간을 갖는다.
 *
 * ⚠️ 정산 배치·금액 확인은 이 화면이 아니다(PLAN D2) — 여기서는 그 기간 매출에 걸린 정산 건으로
 * 넘어가기만 한다.
 */
export function SalesSummaryContainer() {
  const router = useRouter();
  const salesStatsUseCase = useMemo(
    () => new SalesStatsUseCase(new SalesStatsRepositoryImpl()),
    []
  );
  // 정산 건 목록은 정산 도메인이 소유한다 — 매출 API 에 목록을 얹지 않는다(축이 다르다).
  const settlementUseCase = useMemo(
    () => new SettlementUseCase(new SettlementRepositoryImpl()),
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

  // 펼친 판매자의 정산 건 — 🔴 판매자당 1회만 부른다(채널마다 부르면 채널 수만큼 요청이 나간다).
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState('');

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
    setPayouts([]);
    setPayoutsError('');
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
      setPayouts([]);
      setPayoutsError('');
      setPayoutsLoading(true);

      // 채널 매출과 정산 건은 서로를 기다릴 이유가 없다 — 한쪽이 실패해도 다른 쪽은 그린다.
      const channelSales = salesStatsUseCase
        .getChannelSales({ from, to, sellerId })
        .then((channelRows) => setChannels(channelRows))
        .catch(() => setChannelsError('채널별 매출 조회에 실패했습니다.'))
        .finally(() => setChannelsLoading(false));

      const channelPayouts = settlementUseCase
        .getPayoutsByRecognition({ from, to, sellerId })
        .then((payoutRows) => setPayouts(payoutRows))
        .catch(() => setPayoutsError('정산 내역 조회에 실패했습니다.'))
        .finally(() => setPayoutsLoading(false));

      await Promise.all([channelSales, channelPayouts]);
    },
    [salesStatsUseCase, settlementUseCase, expandedSellerId, from, to]
  );

  /**
   * 채널 행 클릭 — 채널별 매출 화면으로 넘긴다.
   *
   * 🔴 보고 있던 기간을 함께 넘긴다. 안 넘기면 9월을 보다가 채널을 눌렀는데 이번 달로 돌아가 버려
   * "왜 숫자가 다르지"가 된다. 받는 쪽은 이 값을 <b>초기값으로만</b> 쓴다.
   *
   * ⚠️ 판매자는 넘기지 않는다 — 저쪽은 채널 하나만 보는 화면이라 판매자 필터가 없다.
   */
  const openChannel = useCallback(
    (accountId: number) => {
      const query = new URLSearchParams({ from, to, accountId: String(accountId) });
      router.push(`${ROUTES.SALES_BY_CHANNEL}?${query.toString()}`);
    },
    [router, from, to]
  );
  // 정산 건별 이동 — 목록을 거치지 않고 그 지급 묶음 상세로 바로 간다.
  const openPayout = useCallback(
    (payoutId: number) => router.push(ROUTES.SETTLEMENT_PAYOUT_DETAIL(payoutId)),
    [router]
  );

  const invalidRange = Boolean(from && to && from > to);
  // 한 행이라도 원가 스냅샷이 없으면 안내를 띄운다 — 순이익 칸의 `—` 가 무슨 뜻인지 화면에 쓴다(D15).
  const showCostBasisNotice = rows.some((row) => !row.costBasisReady);
  // 고정비가 하나라도 걸린 기간에만 설명을 띄운다 — 없는 기간에 띄우면 소음이다.
  const showFixedCostNotice = rows.some((row) => (row.fixedCost ?? 0) > 0);
  const shortPeriod = isShorterThanMonth(from, to);

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">매출</h1>
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

      {showFixedCostNotice && (
        <p className="text-sm text-gray-500">
          채널 고정비는 순이익에서 이미 빠져 있습니다. 그 달 매출이 기준 미만이면 부과되지 않습니다.{' '}
          {/* 🔴 이 문장을 빼지 말 것 — 상품 탭 순이익 합이 채널 탭과 어긋나는 의도된 차이를 설명하는 유일한 자리다. */}
          상품별 순이익에는 포함되지 않습니다.
          {shortPeriod && ' 기간이 한 달보다 짧아도 그 달 고정비 전액이 빠집니다(일할 계산 없음).'}
        </p>
      )}

      <SellerSummaryTable
        rows={rows}
        loading={isLoading}
        error={error}
        expandedSellerId={expandedSellerId}
        channels={channels}
        channelsLoading={channelsLoading}
        channelsError={channelsError}
        payouts={payouts}
        payoutsLoading={payoutsLoading}
        payoutsError={payoutsError}
        onToggle={handleToggle}
        onRetry={() => setReloadTick((tick) => tick + 1)}
        onOpenChannel={openChannel}
        onOpenPayout={openPayout}
      />
    </PageContainer>
  );
}
