'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { ChannelSales, ProductProfit } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import { SalesTabs } from '../../components/SalesTabs';
import { PeriodFilter, currentMonthRange } from '../../components/PeriodFilter';
import { ChannelSalesTable } from './ChannelSalesTable';

/** `yyyy-MM-dd` 모양일 때만 URL 값을 믿는다 — 아무 문자열이나 그대로 서버에 보내면 400 이 난다. */
const asDate = (value: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/**
 * 채널별 매출 화면의 상태 소유자 (FEATURE_2609_34).
 *
 * 소유 상태 = 기간 · 판매자 필터 · 펼친 채널 1개. 통합 매출의 채널 행을 클릭하면 이 화면으로 넘어오므로
 * <b>초기값만</b> 쿼리스트링(`from`/`to`/`sellerId`/`accountId`)에서 읽는다 — 그 뒤의 조작은 URL 에
 * 쓰지 않는다(통합·상품 탭과 같은 규칙: 탭마다 자기 기간을 갖는다).
 *
 * 🔴 초기값을 안 읽으면 9월을 보다가 채널을 눌렀는데 이번 달로 돌아가 버린다 — 넘어온 맥락이 사라진다.
 *
 * ⚠️ 매출 내역·정산 건은 각각 <b>화면당 1회</b> 부른다(채널마다 부르면 채널 수만큼 요청이 나간다).
 * 채널별 분배는 표가 한다.
 *
 * 🔴 매출 내역은 `by-product` 를 <b>`crossChannel: false`</b> 로 부른다 — true 면 채널이 합쳐진
 * 마스터 1행이 와서 채널별로 나눌 수가 없다.
 */
export function ChannelSalesContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const salesStatsUseCase = useMemo(
    () => new SalesStatsUseCase(new SalesStatsRepositoryImpl()),
    []
  );
  const settlementUseCase = useMemo(
    () => new SettlementUseCase(new SettlementRepositoryImpl()),
    []
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  // ⚠️ 마운트 시점의 URL 만 본다(초기값). 이후 `searchParams` 가 바뀌어도 화면 상태를 덮지 않는다.
  const initial = useMemo(() => {
    const range = currentMonthRange();
    return {
      from: asDate(searchParams.get('from')) ?? range.from,
      to: asDate(searchParams.get('to')) ?? range.to,
      sellerId: searchParams.get('sellerId') ?? '',
      accountId: Number(searchParams.get('accountId')) || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [sellerId, setSellerId] = useState(initial.sellerId);
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(initial.accountId);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [rows, setRows] = useState<ChannelSales[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [lines, setLines] = useState<ProductProfit[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState('');

  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState('');

  // 프리셋을 빠르게 연타하면 응답이 역순으로 도착할 수 있다 — 마지막 요청의 결과만 반영한다.
  const requestIdRef = useRef(0);

  useEffect(() => {
    sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => setSellers([])); // 실패해도 목록 조회는 된다(드롭다운만 '전체'로 남는다).
  }, [sellerUseCase]);

  // ⚠️ 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가 막는다
  // — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    const requestId = ++requestIdRef.current;
    const seller = sellerId ? Number(sellerId) : undefined;
    setIsLoading(true);
    setLinesLoading(true);
    setPayoutsLoading(true);
    setError('');
    setLinesError('');
    setPayoutsError('');

    // 셋은 서로를 기다릴 이유가 없다 — 하나가 실패해도 나머지는 그린다.
    const sales = salesStatsUseCase
      .getChannelSales({ from, to, sellerId: seller })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setRows(result);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError('채널별 매출 조회에 실패했습니다.');
        setRows([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });

    const salesLines = salesStatsUseCase
      .getProductProfit({ from, to, sellerId: seller, crossChannel: false })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setLines(result);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setLinesError('매출 내역 조회에 실패했습니다.');
        setLines([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLinesLoading(false);
      });

    const settlements = settlementUseCase
      .getPayoutsByRecognition({ from, to, sellerId: seller })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setPayouts(result);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setPayoutsError('정산 내역 조회에 실패했습니다.');
        setPayouts([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setPayoutsLoading(false);
      });

    await Promise.all([sales, salesLines, settlements]);
  }, [salesStatsUseCase, settlementUseCase, from, to, sellerId]);

  // `reloadTick` 은 [다시 시도] 전용 — 조건이 그대로면 이펙트가 안 돌기 때문에 카운터로 강제한다.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, reloadTick]);

  const handlePeriodChange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
  }, []);

  const handleToggle = useCallback(
    (accountId: number) =>
      setExpandedAccountId((prev) => (prev === accountId ? null : accountId)),
    []
  );

  const openPayout = useCallback(
    (payoutId: number) => router.push(ROUTES.SETTLEMENT_PAYOUT_DETAIL(payoutId)),
    [router]
  );

  const invalidRange = Boolean(from && to && from > to);
  const showCostBasisNotice = rows.some((row) => !row.costBasisReady);

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">매출</h1>
        <p className="text-sm text-gray-500">
          채널 하나를 들여다보는 화면입니다. 채널을 펼치면 그 기간에 무엇이 팔렸는지와, 그 매출에 대한
          정산이 함께 나옵니다.
        </p>
      </div>

      <SalesTabs />

      <PeriodFilter from={from} to={to} isLoading={isLoading} onChange={handlePeriodChange}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">판매자</label>
          <select
            value={sellerId}
            disabled={isLoading}
            onChange={(e) => setSellerId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>
      </PeriodFilter>

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

      <ChannelSalesTable
        rows={rows}
        loading={isLoading}
        error={error}
        lines={lines}
        linesLoading={linesLoading}
        linesError={linesError}
        payouts={payouts}
        payoutsLoading={payoutsLoading}
        payoutsError={payoutsError}
        expandedAccountId={expandedAccountId}
        onToggle={handleToggle}
        onRetry={() => setReloadTick((tick) => tick + 1)}
        onOpenPayout={openPayout}
      />
    </PageContainer>
  );
}
