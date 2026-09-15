'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { SalesStatsUseCase } from '@/application/usecases/SalesStatsUseCase';
import { SalesStatsRepositoryImpl } from '@/infrastructure/repositories/SalesStatsRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { PackingSavingsUseCase } from '@/application/usecases/PackingSavingsUseCase';
import { PackingSavingsRepositoryImpl } from '@/infrastructure/repositories/PackingSavingsRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { ProductProfit } from '@/domain/entities/SalesSummary';
import type { OptionSaving } from '@/domain/entities/PackingSavingsEntity';
import {
  SAVINGS_BASIS_NOTICE,
  SAVINGS_CHANNEL_NOTICE,
  groupSavingsByMaster,
} from '@/domain/entities/PackingSavingsEntity';
import { SalesTabs } from '../../components/SalesTabs';
import { PeriodFilter, currentMonthRange } from '../../components/PeriodFilter';
import { CrossChannelToggle } from './CrossChannelToggle';
import { ProductProfitTable } from './ProductProfitTable';
import type { ProductProfitSortKey } from './ProductProfitTable';

/**
 * 상품별 매출 화면의 상태 소유자 (FEATURE_2609_30 / 04 Step 4).
 *
 * 소유 상태 = 기간 · 판매자 필터 · `crossChannel` · 정렬. `crossChannel` 은 <b>서버 파라미터</b>라
 * 바뀌면 재조회한다(행 수가 실제로 달라진다).
 *
 * 🔴 `미분류` 행은 정렬과 무관하게 항상 맨 아래다 — 순이익 순으로 위에 끼어들면 상품으로 오해한다.
 *
 * 🔴 <b>포장 절약(FEATURE_2609_41)은 별도 조회다</b> — 기준일이 포장 완료일이라 이 화면의 손익(주문일)과
 * 기간이 덮는 주문이 다르다(PLAN 2609_41 S7). 기간 입력은 같은 `PeriodFilter` 를 쓰고(S8), 조회 축은
 * <b>판매자·기간뿐</b>이라 `crossChannel` 을 보내지 않는다(S13).
 */
export function ProductProfitContainer() {
  const salesStatsUseCase = useMemo(
    () => new SalesStatsUseCase(new SalesStatsRepositoryImpl()),
    []
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const packingSavingsUseCase = useMemo(
    () => new PackingSavingsUseCase(new PackingSavingsRepositoryImpl()),
    []
  );

  const initialRange = useMemo(() => currentMonthRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [sellerId, setSellerId] = useState('');
  const [crossChannel, setCrossChannel] = useState(true);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [rows, setRows] = useState<ProductProfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  // 기본 정렬 = 순이익 내림차순. 원가 스냅샷 게이트 전에는 전 행이 `—` 라 매출 내림차순으로 내린다.
  const [sortKey, setSortKey] = useState<ProductProfitSortKey>('estNetProfit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 포장 절약 — 옵션 단위로 오므로 표시 직전에 마스터로 접는다(S16).
  const [optionSavings, setOptionSavings] = useState<OptionSaving[]>([]);
  const [expandedSavingsMasterId, setExpandedSavingsMasterId] = useState<number | null>(null);

  const requestIdRef = useRef(0);
  // 절약은 매출과 다른 API 라 요청 순서를 따로 센다.
  const savingsRequestIdRef = useRef(0);

  useEffect(() => {
    sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => setSellers([])); // 실패해도 목록 조회 자체는 된다(드롭다운만 '전체'로 남는다).
  }, [sellerUseCase]);

  // ⚠️ 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가 막는다
  // — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      const result = await salesStatsUseCase.getProductProfit({
        from,
        to,
        sellerId: sellerId ? Number(sellerId) : undefined,
        crossChannel,
      });
      if (requestId !== requestIdRef.current) return;
      setRows(result);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError('상품별 매출 조회에 실패했습니다.');
      setRows([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [salesStatsUseCase, from, to, sellerId, crossChannel]);

  // 🔴 `crossChannel` 을 보내지 않는다(S13) — 포장은 창고 행위라 채널 축이 없다.
  //    조회 실패해도 손익 표는 그대로 뜬다(절약 열만 `—`).
  const loadSavings = useCallback(async () => {
    if (!from || !to || from > to) return;
    const requestId = ++savingsRequestIdRef.current;
    try {
      const result = await packingSavingsUseCase.getOptions({
        from,
        to,
        sellerId: sellerId ? Number(sellerId) : undefined,
      });
      if (requestId !== savingsRequestIdRef.current) return;
      setOptionSavings(result);
    } catch {
      if (requestId !== savingsRequestIdRef.current) return;
      setOptionSavings([]);
    }
  }, [packingSavingsUseCase, from, to, sellerId]);

  // `reloadTick` 은 [다시 시도] 전용 — 조건이 그대로면 이펙트가 안 돌기 때문에 카운터로 강제한다.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, reloadTick]);

  useEffect(() => {
    void (async () => {
      await loadSavings();
    })();
  }, [loadSavings, reloadTick]);

  const handlePeriodChange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    // 펼쳐둔 옵션 행은 이전 기간의 값이다 — 접어서 기간이 섞이지 않게 한다.
    setExpandedSavingsMasterId(null);
  }, []);

  const handleToggleSavings = useCallback((masterProductId: number) => {
    setExpandedSavingsMasterId((prev) => (prev === masterProductId ? null : masterProductId));
  }, []);

  // ⚠️ set-state updater 안에서 다른 set-state 를 부르지 않는다 — StrictMode 가 updater 를 두 번
  // 실행해 방향이 두 번 뒤집힌다(정렬이 안 바뀌는 것처럼 보인다).
  const handleSort = useCallback(
    (key: ProductProfitSortKey) => {
      if (sortKey === key) {
        setSortDir((prevDir) => (prevDir === 'desc' ? 'asc' : 'desc'));
        return;
      }
      setSortKey(key);
      setSortDir('desc');
    },
    [sortKey]
  );

  const costBasisReady = rows.length > 0 && rows.every((row) => row.costBasisReady);
  const showCostBasisNotice = rows.some((row) => !row.costBasisReady);

  const sortedRows = useMemo(() => {
    // 순이익을 모르는 상태에서 순이익 정렬은 무의미하다 — 매출 축으로 대신한다(라벨은 그대로 둔다).
    const effectiveKey: ProductProfitSortKey =
      sortKey === 'estNetProfit' && !costBasisReady ? 'grossSales' : sortKey;
    const value = (row: ProductProfit) =>
      effectiveKey === 'estNetProfit' ? (row.estNetProfit ?? 0) : row[effectiveKey];
    return [...rows].sort((a, b) => {
      // 미분류는 정렬 축과 무관하게 맨 아래.
      if (a.uncategorized !== b.uncategorized) return a.uncategorized ? 1 : -1;
      const diff = value(a) - value(b);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [rows, sortKey, sortDir, costBasisReady]);

  const savingsByMaster = useMemo(() => groupSavingsByMaster(optionSavings), [optionSavings]);
  // 🔴 채널별 보기에서는 절약을 내지 않는다(S13) — 같은 절약이 채널마다 반복돼 합계가 부풀어 보인다.
  const hasSavings = !crossChannel ? false : savingsByMaster.size > 0;

  const invalidRange = Boolean(from && to && from > to);

  return (
    <PageContainer title="매출">
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

        <CrossChannelToggle
          crossChannel={crossChannel}
          disabled={isLoading}
          onChange={(next) => {
            setCrossChannel(next);
            setExpandedSavingsMasterId(null);
          }}
        />
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

      {/* 🔴 기준일이 다르다는 사실과, 채널별 보기에서 절약을 내지 않는 이유를 표 위에 한 줄로 밝힌다. */}
      {!crossChannel ? (
        <p className="text-sm text-gray-500">{SAVINGS_CHANNEL_NOTICE}</p>
      ) : (
        hasSavings && <p className="text-sm text-gray-500">포장 절약은 {SAVINGS_BASIS_NOTICE}</p>
      )}

      <ProductProfitTable
        rows={sortedRows}
        showChannel={!crossChannel}
        savingsByMaster={savingsByMaster}
        expandedSavingsMasterId={expandedSavingsMasterId}
        onToggleSavings={handleToggleSavings}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={isLoading}
        error={error}
        onSort={handleSort}
        onRetry={() => setReloadTick((tick) => tick + 1)}
      />
    </PageContainer>
  );
}
