'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { ShippingLabelRepositoryImpl } from '@/infrastructure/repositories/ShippingLabelRepositoryImpl';
import { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { CANCELED_FILTER, isFullyCanceled, matchesOrderSearch } from '@/domain/entities/OrderEntity';
import type { OrderSearchField } from '@/domain/entities/OrderEntity';
import {
  RECENT_PERIOD, buildPeriodOptions, isMonthPeriod, toPeriodRange,
} from '@/domain/entities/OrderPeriod';
import type { SyncTarget } from '@/application/dto/OrderDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { useOrderSync } from '@/presentation/hooks/useOrderSync';
import { OrderSearchCard } from './OrderSearchCard';
import { channelOptionLabel } from './OrderSearchCard';
import type { ChannelOption } from './OrderSearchCard';
import { OrderStatusFilter } from './OrderStatusFilter';
import { OrderTable } from './OrderTable';
import { OrderDetailsModal } from './OrderDetailsModal';
import { SyncProgressModal } from './SyncProgressModal';
import { PeriodBackfillDialog } from './PeriodBackfillDialog';

const PAGE_SIZE = 20;

const CHANNEL_NOT_SYNCABLE = '동기화할 수 없는 채널입니다(비활성).';

export function OrderContainer() {
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const shippingLabelUseCase = useMemo(
    () => new ShippingLabelUseCase(new ShippingLabelRepositoryImpl()),
    []
  );

  // 상세 모달의 단건 발송처리 섹션이 계속 쓴다(송장시트·발송처리 버튼은 출고관리로 옮겼다).
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof OrderItem | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  // Period shown in the dropdown: picked but not yet applied to the list (needs [조회]).
  const [selectedPeriod, setSelectedPeriod] = useState<string>(RECENT_PERIOD);
  // Period the current list actually holds. The stale notice reads THIS one — reading
  // selectedPeriod would hide the notice when the select is reverted while the list is still 8월.
  const [appliedPeriod, setAppliedPeriod] = useState<string>(RECENT_PERIOD);
  const [searchField, setSearchField] = useState<OrderSearchField>('customer');
  const [searchTerm, setSearchTerm] = useState('');
  // Months that have orders — only used to label options '(데이터 없음)'.
  const [monthsWithData, setMonthsWithData] = useState<ReadonlySet<string>>(new Set());
  const periodOptions = useMemo(() => buildPeriodOptions(monthsWithData), [monthsWithData]);
  // Empty month to offer a backfill for. null = the dialog stays closed.
  const [backfillPrompt, setBackfillPrompt] = useState<{ period: string; label: string } | null>(null);
  // Suppresses a second prompt for the same scope in this session (PLAN D10) — asking once is
  // enough whether the user accepted, declined or the backfill failed. A ref because the value
  // never needs a re-render and the search callback must see the latest one.
  const askedPeriodsRef = useRef<Set<string>>(new Set());
  // Whether the progress modal is currently showing a backfill run: [재시도] means something
  // different on each path (a regular sync would overwrite the "last sync" banner, PLAN D5).
  const [isBackfillRun, setIsBackfillRun] = useState(false);
  const backfillPeriodRef = useRef<string | null>(null);

  // Reuse existing SellerUseCase.getAll() for the seller dropdown
  useEffect(() => {
    const loadSellers = async () => {
      try {
        const result = await sellerUseCase.getAll();
        setSellers(result);
      } catch {
        // Non-blocking: dropdown falls back to '전체' only
      }
    };
    loadSellers();
  }, [sellerUseCase]);

  // Fetched once on entry and deliberately not refetched after a search or sync: the sync window is
  // only 14 days, so new orders are almost always in the current month, and refetching on every
  // search would make the dropdown labels flicker. A failure only costs the labels.
  useEffect(() => {
    orderUseCase.getOrderMonths()
      .then((rows) => setMonthsWithData(new Set(rows.map((r) => r.ym))))
      .catch(() => { /* labels only — the query itself still works */ });
  }, [orderUseCase]);

  // Banner source: the server-persisted per-channel sync status. Failures only hide the banner.
  // Returns the fetched rows (null on failure) so the caller can reuse them without a second call.
  const loadSyncTargets = useCallback(async (sellerId: number | ''): Promise<SyncTarget[] | null> => {
    try {
      const targets = await orderUseCase.getSyncTargets(sellerId || undefined);
      setSyncTargets(targets);
      return targets;
    } catch {
      setSyncTargets([]);
      return null;
    }
  }, [orderUseCase]);

  // On first entry: load all sellers' orders without requiring a search click.
  // (The persisted last sync time is restored by useOrderSync.)
  useEffect(() => {
    const loadInitialOrders = async () => {
      try {
        setIsLoading(true);
        const result = await orderUseCase.getOrders();
        setOrders(result);
        setHasSearched(true);
        await loadSyncTargets('');
      } catch {
        setError('주문 조회에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialOrders();
  }, [orderUseCase, loadSyncTargets]);

  // 동기화 루프가 끝난 뒤의 목록 재조회. 화면마다 다르므로 훅에 넘긴다.
  // 훅보다 먼저 선언한다(useCallback 은 TDZ).
  const refetchAfterSync = useCallback(async () => {
    // The per-call `orders` payload is scoped by the sellerId parameter, so it is not reused —
    // the list is refetched once after the loop instead.
    try {
      const result = await orderUseCase.getOrders(
        selectedSellerId || undefined,
        toPeriodRange(selectedPeriod)
      );
      setOrders(result);
      setAppliedPeriod(selectedPeriod);
      setHasSearched(true);
      setCurrentPage(0);
    } catch {
      setError('주문 목록을 불러오지 못했습니다.');
    }
  }, [orderUseCase, selectedSellerId, selectedPeriod]);

  // 함수 선언문이라 호이스팅된다 — 훅이 돌려주는 applyChannelErrors 를 호출 시점(렌더 이후)에 읽는다.
  async function handleSyncSettled() {
    const refreshed = await loadSyncTargets(selectedSellerId);
    if (!refreshed) return;
    applyChannelErrors(new Map(
      refreshed
        .filter((t): t is SyncTarget & { lastSyncError: string } => Boolean(t.lastSyncError))
        .map((t) => [t.accountId, t.lastSyncError])
    ));
  }

  const {
    runChannels, runSync, applyChannelErrors, failedTargets,
    isSyncing, syncChannels, syncCursor, syncCanceled, syncModalOpen, syncResult, lastSyncedAt,
    cancelSync, closeSyncModal, stopSyncing, clearSyncResult,
  } = useOrderSync({ onAfterSync: refetchAfterSync, onSyncSettled: handleSyncSettled });

  // 채널 옵션 = 동기화 대상 ∪ 조회된 목록의 계정(PLAN 2609_15 D7-a).
  // ⚠️ 대상(활성 계정)만으로 채우면 비활성 채널의 과거 주문이 필터에서 영영 사라진다.
  const channelOptions = useMemo<ChannelOption[]>(() => {
    const byId = new Map<number, ChannelOption>();
    syncTargets.forEach((t) => byId.set(t.accountId, {
      accountId: t.accountId,
      label: channelOptionLabel(t.accountId, t.accountAlias),
      syncable: true,
    }));
    orders.forEach((o) => {
      if (byId.has(o.marketplaceAccountId)) return;
      // 목록에만 있는 계정은 이름을 모른다.
      byId.set(o.marketplaceAccountId, {
        accountId: o.marketplaceAccountId,
        label: channelOptionLabel(o.marketplaceAccountId, null),
        syncable: false,
      });
    });
    return [...byId.values()].sort((a, b) => a.accountId - b.accountId);
  }, [syncTargets, orders]);

  const selectedChannel = useMemo(
    () => channelOptions.find((c) => c.accountId === selectedAccountId),
    [channelOptions, selectedAccountId]
  );
  // 조회는 되고 동기화는 안 되는 상태를 그대로 드러낸다(D7-a).
  const syncDisabledReason =
    selectedAccountId !== '' && selectedChannel && !selectedChannel.syncable
      ? CHANNEL_NOT_SYNCABLE
      : undefined;

  // 기간(서버) -> 채널 -> 검색 -> 상태 -> 정렬 -> 페이징. 배지 건수도 이 결과를 센다.
  const channelFilteredOrders = useMemo(
    () => (selectedAccountId === ''
      ? orders
      : orders.filter((o) => o.marketplaceAccountId === selectedAccountId)),
    [orders, selectedAccountId]
  );

  const searchedOrders = useMemo(
    () => channelFilteredOrders.filter((o) => matchesOrderSearch(o, searchField, searchTerm)),
    [channelFilteredOrders, searchField, searchTerm]
  );

  // Count orders per status for the filter button badges (unaffected by selection).
  // Fully-canceled orders are excluded here and counted separately below.
  const statusCounts = useMemo(() => {
    return searchedOrders.reduce<Record<string, number>>((acc, order) => {
      if (isFullyCanceled(order)) return acc;
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [searchedOrders]);

  // Fully-canceled orders (orderCount === cancelCount) surfaced under the 취소항목 chip
  const canceledCount = useMemo(() => searchedOrders.filter(isFullyCanceled).length, [searchedOrders]);

  // Apply the selected filter before sorting/paging:
  // - CANCELED_FILTER: only fully-canceled orders
  // - a status code: that status, excluding fully-canceled ones
  // - null: all orders except fully-canceled (those live under 취소항목)
  const filteredOrders = useMemo(() => {
    if (selectedStatus === CANCELED_FILTER) return searchedOrders.filter(isFullyCanceled);
    if (selectedStatus == null) return searchedOrders.filter((o) => !isFullyCanceled(o));
    return searchedOrders.filter((o) => o.status === selectedStatus && !isFullyCanceled(o));
  }, [searchedOrders, selectedStatus]);

  const sortedOrders = useMemo(() => {
    if (sortKey == null) return filteredOrders;
    const copy = [...filteredOrders];
    copy.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      // Null values always go last regardless of direction
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      let comparison: number;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return copy;
  }, [filteredOrders, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedOrders.length / PAGE_SIZE);

  const pagedOrders = useMemo(
    () => sortedOrders.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [sortedOrders, currentPage]
  );

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError('');
      clearSyncResult();
      const result = await orderUseCase.getOrders(
        selectedSellerId || undefined,
        toPeriodRange(selectedPeriod)
      );
      setOrders(result);
      setAppliedPeriod(selectedPeriod);
      setHasSearched(true);
      setCurrentPage(0);
      await loadSyncTargets(selectedSellerId);

      // Empty month -> offer to fetch it from Coupang once (PLAN D1). '최근 2주' never asks:
      // it is already inside the sync window, so empty there means there is really nothing.
      const key = `${selectedSellerId || 'all'}:${selectedPeriod}`;
      if (result.length === 0 && isMonthPeriod(selectedPeriod) && !askedPeriodsRef.current.has(key)) {
        askedPeriodsRef.current.add(key);   // recorded when asked - declining does not re-ask
        const label = periodOptions.find((o) => o.value === selectedPeriod)?.label ?? selectedPeriod;
        setBackfillPrompt({ period: selectedPeriod, label });
      }
    } catch {
      setError('주문 조회에 실패했습니다. 다시 시도해주세요.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 표준 동기화 진입점. 백필 플래그를 내리는 건 화면 몫이다(훅은 백필의 존재를 모른다).
  const startSync = (targets: SyncTarget[]) => {
    setIsBackfillRun(false);
    setError('');
    return runSync(targets);
  };

  // Backfills one month, account by account. Borrows the shared channel runner but calls the period
  // endpoint, refetches the selected period afterwards and deliberately leaves the sync banners
  // alone (the server records no channel status for a period backfill, PLAN 2609_10 D5).
  // retryTargets: the progress modal's [재시도] path - only those channels run again.
  const runPeriodBackfill = async (period: string, retryTargets?: SyncTarget[]) => {
    const range = toPeriodRange(period);
    if (!range) return;                                   // RECENT guard - unreachable
    let targets: SyncTarget[];
    if (retryTargets) {
      targets = retryTargets;
    } else {
      try {
        targets = await orderUseCase.getSyncTargets(selectedSellerId || undefined);   // PLAN D12
      } catch {
        setError('동기화 대상을 불러오지 못했습니다.');
        return;
      }
    }
    if (targets.length === 0) {
      setError('불러올 채널이 없습니다.');
      return;
    }

    setIsBackfillRun(true);
    backfillPeriodRef.current = period;
    setError('');

    let newOrders = 0;
    await runChannels(targets, async (target) => {
      const result = await orderUseCase.syncPeriod(target.accountId, range);
      newOrders += result.newOrders;                      // PLAN D9
    });
    // 백필은 루프 직후 스피너를 푼다(표준 동기화는 재조회까지 끝낸 뒤 — 현행 유지).
    stopSyncing();

    // Refetch the period that was backfilled - the month the screen was looking at.
    try {
      const refreshed = await orderUseCase.getOrders(selectedSellerId || undefined, range);
      setOrders(refreshed);
      setCurrentPage(0);
      if (refreshed.length === 0 && newOrders === 0) {
        setError('쿠팡에도 해당 기간 주문이 없습니다.');      // PLAN D11
      }
    } catch {
      setError('주문 목록을 불러오지 못했습니다.');
    }

    // Something landed -> drop the '(데이터 없음)' label from the dropdown (PLAN D15).
    if (newOrders > 0) {
      try {
        const rows = await orderUseCase.getOrderMonths();
        setMonthsWithData(new Set(rows.map((r) => r.ym)));
      } catch { /* label refresh failure is harmless */ }
    }
  };

  const handleSync = async () => {
    try {
      const targets = await orderUseCase.getSyncTargets(selectedSellerId || undefined);
      // 동기화 가능한 채널이 선택돼 있으면 그 대상 1개만 돌린다(PLAN 2609_15 D7).
      const scoped = selectedAccountId === '' || syncDisabledReason
        ? targets
        : targets.filter((t) => t.accountId === selectedAccountId);
      if (scoped.length === 0) {
        setError('동기화할 채널이 없습니다.');
        return;
      }
      await startSync(scoped);
    } catch {
      setError('동기화 대상을 불러오지 못했습니다.');
    }
  };

  const handleRetryFailed = () => {
    if (failedTargets.length === 0) return;
    // Retrying a failed backfill re-runs the backfill for that period - routing it through the
    // regular sync would stamp the "last sync" banner with a period run (PLAN 2609_10 D5).
    if (isBackfillRun && backfillPeriodRef.current) {
      void runPeriodBackfill(backfillPeriodRef.current, failedTargets);
      return;
    }
    void startSync(failedTargets);
  };

  const handleSort = (key: keyof OrderItem) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(0);
  };

  // Search input / chip changes reset to page 1 (searching from page 3 would show a blank list).
  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
  };

  const handleSearchFieldChange = (field: OrderSearchField) => {
    setSearchField(field);
    setCurrentPage(0);
  };

  // The period only takes effect on [조회] — this just records the picked value.
  const handlePeriodChange = (value: string) => setSelectedPeriod(value);

  // 판매자를 바꾸면 채널 선택을 푼다 — 다른 판매자의 계정이 남으면 목록이 영문 없이 0건이 된다.
  const handleSellerChange = (value: number | '') => {
    setSelectedSellerId(value);
    setSelectedAccountId('');
  };

  const handleAccountChange = (value: number | '') => {
    setSelectedAccountId(value);
    setCurrentPage(0);
  };

  const handleStatusChange = (status: string | null) => {
    setSelectedStatus(status);
    setCurrentPage(0);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowClick = (order: OrderItem) => {
    setSelectedOrder(order);
  };

  // Reason text is owned by the server (lastSyncError) — never composed here.
  const nonSuccessTargets = syncTargets.filter(
    (t) => t.lastSyncStatus && t.lastSyncStatus !== 'SUCCESS'
  );

  return (
    <PageContainer contentClassName="max-w-7xl mx-auto space-y-6">
        <OrderSearchCard
          sellers={sellers}
          selectedSellerId={selectedSellerId}
          onSellerChange={handleSellerChange}
          onSearch={handleSearch}
          onSync={handleSync}
          isLoading={isLoading}
          isSyncing={isSyncing}
          resultCount={searchedOrders.length}
          channelOptions={channelOptions}
          selectedAccountId={selectedAccountId}
          onAccountChange={handleAccountChange}
          syncDisabledReason={syncDisabledReason}
          periodOptions={periodOptions}
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          searchField={searchField}
          onSearchFieldChange={handleSearchFieldChange}
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          showStaleNotice={isMonthPeriod(appliedPeriod)}
          lastSyncedAt={lastSyncedAt}
        />

        {syncResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            동기화 완료 — 신규 {syncResult.newOrders}건, 수정 {syncResult.updatedOrders}건, 취소 {syncResult.canceledUpdated}건
          </div>
        )}

        {nonSuccessTargets.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm">
            <p className="font-medium">
              ⚠️ 마지막 동기화가 완료되지 않은 채널이 {nonSuccessTargets.length}개 있습니다
            </p>
            <ul className="mt-2 space-y-1">
              {nonSuccessTargets.map((target) => {
                const reason =
                  target.lastSyncStatus === 'FAILED'
                    ? `(실패) ${target.lastSyncError ?? ''}`.trim()
                    : target.lastSyncError ?? '부분 성공';
                return (
                  <li key={target.accountId} className="line-clamp-2" title={reason}>
                    · {target.sellerName}·{target.platform} — {reason}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => void startSync(nonSuccessTargets)}
              disabled={isSyncing}
              className="mt-3 px-4 py-2 border border-amber-300 rounded-lg font-medium hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              해당 채널만 다시 조회
            </button>
          </div>
        )}

        <OrderStatusFilter
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          counts={statusCounts}
          canceledCount={canceledCount}
        />

        {/* -mt-4 cancels the parent's 24px stack gap so the note reads as part of the chip row. */}
        {selectedStatus === 'NONE_TRACKING' && (
          <p className="-mt-4 text-xs text-gray-500">
            업체가 직접 배송해 배송 연동이 적용되지 않는 주문입니다 — 송장 추적이 불가합니다.
          </p>
        )}

        <OrderTable
          orders={pagedOrders}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={handleRowClick}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />

        {/* key remount resets the modal's sheet state when the order changes or the modal closes
            (it is always rendered, so it never unmounts on its own). */}
        <OrderDetailsModal
          key={selectedOrder?.id ?? 'none'}
          order={selectedOrder}
          onClose={(didSucceed) => {
            setSelectedOrder(null);
            // Re-run the current search so the write-back'd 배송지시 row shows up without a full reload.
            if (didSucceed) void handleSearch();
          }}
          isAdmin={isAdmin}
          useCase={shippingLabelUseCase}
          orderUseCase={orderUseCase}
        />

        <SyncProgressModal
          open={syncModalOpen}
          channels={syncChannels}
          doneCount={syncCursor}
          isRunning={isSyncing}
          canceled={syncCanceled}
          onCancel={cancelSync}
          onRetryFailed={handleRetryFailed}
          onClose={closeSyncModal}
        />

        <PeriodBackfillDialog
          open={backfillPrompt != null}
          periodLabel={backfillPrompt?.label ?? ''}
          onCancel={() => setBackfillPrompt(null)}
          onConfirm={() => {
            const period = backfillPrompt?.period;
            setBackfillPrompt(null);           // close first so it does not stack on the progress modal
            if (period) void runPeriodBackfill(period);
          }}
        />
    </PageContainer>
  );
}
