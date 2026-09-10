'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import type { ChannelSales, ProductProfit, SalesLine } from '@/domain/entities/SalesSummary';
import { channelLabel } from '@/domain/entities/SalesSummary';
import { SalesTabs } from '../../components/SalesTabs';
import { PeriodFilter, currentMonthRange } from '../../components/PeriodFilter';
import { ChannelSummaryCard } from './ChannelSummaryCard';
import { ChannelSalesLines } from './ChannelSalesLines';
import { ChannelSaleRecords } from './ChannelSaleRecords';

/** `yyyy-MM-dd` 모양일 때만 URL 값을 믿는다 — 아무 문자열이나 그대로 서버에 보내면 400 이 난다. */
const asDate = (value: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** 셀렉트 라벨. 별칭이 겹칠 수 있어 판매자명을 함께 보여준다. */
const optionLabel = (channel: ChannelSales): string =>
  channel.sellerName?.trim()
    ? `${channel.sellerName} · ${channelLabel(channel)}`
    : channelLabel(channel);

/**
 * 채널별 매출 화면의 상태 소유자 (FEATURE_2609_34).
 *
 * 🔴 <b>한 번에 채널 하나만 본다.</b> 통합 매출이 플랫폼·판매자를 가로질러 보는 곳이고, 여기는 그 채널
 * <b>안</b>을 들여다보는 곳이다 — 그래서 판매자 필터도 행 펼침도 없다. 위에서 채널을 고르면 그 채널의
 * 합계 · 상품별 매출 · 판매 내역이 아래로 이어진다.
 *
 * 🔴 <b>정산은 이 화면에 없다.</b> 여기는 매출 내역 화면이고, 정산은 축(매출인식월)도 정본(쿠팡 배치)도
 * 달라서 통합 매출과 정산 화면이 따로 다룬다 — 섞으면 두 숫자를 빼 보게 된다.
 *
 * 소유 상태 = 기간 · 선택 채널. 통합 매출의 채널 행에서 넘어오므로 <b>초기값만</b> 쿼리스트링
 * (`from`/`to`/`accountId`)에서 읽는다 — 안 읽으면 9월을 보다가 채널을 눌렀는데 이번 달로 돌아가 버린다.
 *
 * ⚠️ 채널 목록·상품별 매출은 <b>화면당 1회</b>, 판매 내역만 선택 채널이 바뀔 때 다시 부른다.
 */
export function ChannelSalesContainer() {
  const searchParams = useSearchParams();

  const salesStatsUseCase = useMemo(
    () => new SalesStatsUseCase(new SalesStatsRepositoryImpl()),
    []
  );

  // ⚠️ 마운트 시점의 URL 만 본다(초기값). 이후 `searchParams` 가 바뀌어도 화면 상태를 덮지 않는다.
  const initial = useMemo(() => {
    const range = currentMonthRange();
    return {
      from: asDate(searchParams.get('from')) ?? range.from,
      to: asDate(searchParams.get('to')) ?? range.to,
      accountId: Number(searchParams.get('accountId')) || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [accountId, setAccountId] = useState<number | null>(initial.accountId);

  const [channels, setChannels] = useState<ChannelSales[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [products, setProducts] = useState<ProductProfit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const [records, setRecords] = useState<SalesLine[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  // 프리셋을 빠르게 연타하면 응답이 역순으로 도착할 수 있다 — 마지막 요청의 결과만 반영한다.
  const requestIdRef = useRef(0);
  const recordsRequestIdRef = useRef(0);

  // ⚠️ 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가 막는다
  // — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
  const loadChannels = useCallback(async () => {
    if (!from || !to || from > to) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setProductsLoading(true);
    setError('');
    setProductsError('');

    const channelSales = salesStatsUseCase
      .getChannelSales({ from, to })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setChannels(result);
        // 넘어온 채널이 없으면 첫 채널을 고른다 — 빈 화면으로 시작하지 않는다.
        setAccountId((prev) =>
          prev != null && result.some((row) => row.accountId === prev)
            ? prev
            : (result[0]?.accountId ?? null)
        );
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError('채널별 매출 조회에 실패했습니다.');
        setChannels([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });

    // 🔴 `crossChannel: false` 여야 채널이 붙어 온다 — true 면 채널이 합쳐진 마스터 1행이라 나눌 수 없다.
    const productSales = salesStatsUseCase
      .getProductProfit({ from, to, crossChannel: false })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setProducts(result);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setProductsError('상품별 매출 조회에 실패했습니다.');
        setProducts([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setProductsLoading(false);
      });

    await Promise.all([channelSales, productSales]);
  }, [salesStatsUseCase, from, to]);

  // `reloadTick` 은 [다시 시도] 전용 — 조건이 그대로면 이펙트가 안 돌기 때문에 카운터로 강제한다.
  useEffect(() => {
    void (async () => {
      await loadChannels();
    })();
  }, [loadChannels, reloadTick]);

  // 판매 내역만 선택 채널을 탄다 — 채널을 바꿀 때마다 위 두 조회까지 다시 돌 이유가 없다.
  const loadRecords = useCallback(async () => {
    if (accountId == null || !from || !to || from > to) {
      setRecords([]);
      return;
    }
    const requestId = ++recordsRequestIdRef.current;
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const result = await salesStatsUseCase.getSalesLines({ from, to, accountId });
      if (requestId !== recordsRequestIdRef.current) return;
      setRecords(result);
    } catch {
      if (requestId !== recordsRequestIdRef.current) return;
      setRecordsError('판매 내역 조회에 실패했습니다.');
      setRecords([]);
    } finally {
      if (requestId === recordsRequestIdRef.current) setRecordsLoading(false);
    }
  }, [salesStatsUseCase, from, to, accountId]);

  useEffect(() => {
    void (async () => {
      await loadRecords();
    })();
  }, [loadRecords, reloadTick]);

  const handlePeriodChange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
  }, []);

  const selected = channels.find((channel) => channel.accountId === accountId) ?? null;
  const invalidRange = Boolean(from && to && from > to);

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">매출</h1>
        <p className="text-sm text-gray-500">
          채널 하나의 매출을 들여다보는 화면입니다. 그 기간에 무엇이 얼마나 팔렸는지와, 어느 주문에서
          나온 매출인지를 보여줍니다.
        </p>
      </div>

      <SalesTabs />

      <PeriodFilter from={from} to={to} isLoading={isLoading} onChange={handlePeriodChange}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">채널</label>
          <select
            value={accountId ?? ''}
            disabled={isLoading || channels.length === 0}
            onChange={(e) => setAccountId(Number(e.target.value) || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {channels.length === 0 && <option value="">채널 없음</option>}
            {channels.map((channel) => (
              <option key={channel.accountId} value={channel.accountId}>
                {optionLabel(channel)}
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

      {error && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setReloadTick((tick) => tick + 1)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {!error && selected == null && !isLoading && (
        <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-sm text-gray-500">
          조회할 판매채널이 없습니다.
        </div>
      )}

      {selected != null && (
        <>
          <ChannelSummaryCard channel={selected} />

          {!selected.costBasisReady && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              순이익 추정치는 상품 단가와 비용(택배비, 상자비 등)이 모두 작성 완료되어야 표시가능합니다.
            </div>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">상품별 매출</h2>
            <div className="bg-white rounded-lg shadow px-6 py-4 list-table-scroll">
              <ChannelSalesLines
                rows={products.filter((row) => row.accountId === selected.accountId)}
                isLoading={productsLoading}
                error={productsError}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">
              판매 내역
              <span className="ml-2 text-xs font-normal text-gray-500">
                {records.length.toLocaleString('ko-KR')}건 · 판매일 최근순
              </span>
            </h2>
            <ChannelSaleRecords rows={records} isLoading={recordsLoading} error={recordsError} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
