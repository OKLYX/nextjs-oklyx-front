'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
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
import type { OrderSyncResponse, SyncTarget } from '@/application/dto/OrderDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { OrderSearchCard } from './OrderSearchCard';
import { OrderStatusFilter } from './OrderStatusFilter';
import { OrderTable } from './OrderTable';
import { OrderDetailsModal } from './OrderDetailsModal';
import { ShipmentConfirmModal } from './ShipmentConfirmModal';
import { ShippingLabelPreviewModal } from './ShippingLabelPreviewModal';
import { SyncProgressModal } from './SyncProgressModal';
import { PeriodBackfillDialog } from './PeriodBackfillDialog';
import type { ChannelProgress } from './SyncProgressModal';

const PAGE_SIZE = 20;
const LAST_SYNCED_AT_KEY = 'oklyx_order_last_synced_at';

const markState = (
  list: ChannelProgress[], index: number, state: ChannelProgress['state'], error?: string,
): ChannelProgress[] => list.map((c, i) => (i === index ? { ...c, state, error } : c));

// The server owns the reason text: use the received message as-is, falling back only when absent.
const extractMessage = (e: unknown): string =>
  (axios.isAxiosError(e) ? e.response?.data?.message : undefined) ?? '동기화에 실패했습니다.';

export function OrderContainer() {
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const shippingLabelUseCase = useMemo(
    () => new ShippingLabelUseCase(new ShippingLabelRepositoryImpl()),
    []
  );

  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [syncResult, setSyncResult] = useState<OrderSyncResponse | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof OrderItem | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [syncChannels, setSyncChannels] = useState<ChannelProgress[]>([]);
  const [syncCursor, setSyncCursor] = useState(0);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncCanceled, setSyncCanceled] = useState(false);
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
  // Cancel is requested through a ref so the running loop sees it without a re-render.
  const cancelRef = useRef(false);
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

  // On first entry: restore the persisted last sync time and load all sellers' orders
  // without requiring a search click. Reads run inside the async callback to avoid
  // synchronous setState in the effect body.
  useEffect(() => {
    const loadInitialOrders = async () => {
      try {
        setIsLoading(true);
        const persisted = localStorage.getItem(LAST_SYNCED_AT_KEY);
        const result = await orderUseCase.getOrders();
        setLastSyncedAt(persisted);
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

  // Search -> status filter -> sort -> paging. The badge counts also count this result.
  const searchedOrders = useMemo(
    () => orders.filter((o) => matchesOrderSearch(o, searchField, searchTerm)),
    [orders, searchField, searchTerm]
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
      setSyncResult(null);
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

  // One account per call: the server isolates accounts only inside its multi-account path, so the
  // per-channel failure handling lives here. Only accountId is sent — adding sellerId would clash
  // with the server's accountId > sellerId priority and blur the scope of the response.
  const runSync = async (targets: SyncTarget[]) => {
    setIsBackfillRun(false);
    cancelRef.current = false;
    setSyncCanceled(false);
    setSyncModalOpen(true);
    setIsSyncing(true);
    setError('');
    setSyncChannels(targets.map((t) => ({ target: t, state: 'pending' })));
    setSyncCursor(0);

    let newOrders = 0;
    let updatedOrders = 0;
    let canceledUpdated = 0;

    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) {
        setSyncCanceled(true);
        break;
      }
      setSyncChannels((prev) => markState(prev, i, 'running'));
      try {
        const result = await orderUseCase.syncOrders({ accountId: targets[i].accountId });
        newOrders += result.newOrders;
        updatedOrders += result.updatedOrders;
        canceledUpdated += result.canceledUpdated;
        setSyncChannels((prev) => markState(prev, i, 'success'));
      } catch (e) {
        setSyncChannels((prev) => markState(prev, i, 'failed', extractMessage(e)));
      }
      setSyncCursor(i + 1);
    }

    // The per-call `orders` payload is scoped by the sellerId parameter, so it is not reused here —
    // the list is refetched once after the loop instead.
    try {
      const orders = await orderUseCase.getOrders(
        selectedSellerId || undefined,
        toPeriodRange(selectedPeriod)
      );
      setOrders(orders);
      setAppliedPeriod(selectedPeriod);
      setHasSearched(true);
      setCurrentPage(0);
    } catch {
      setError('주문 목록을 불러오지 못했습니다.');
    }

    const syncedAt = new Date().toISOString();
    setLastSyncedAt(syncedAt);
    localStorage.setItem(LAST_SYNCED_AT_KEY, syncedAt);
    setSyncResult({ syncedAt, newOrders, updatedOrders, canceledUpdated, orders: [] });
    setIsSyncing(false);

    // The reason still comes from the server (D18), but from the channel status the sync just
    // stamped rather than the HTTP envelope: sync failures surface as IllegalStateException /
    // RestClientException, which the backend's catch-all handler answers with the generic
    // "Internal server error" body. `lastSyncError` carries the real one ("HTTP 504 from Coupang").
    const refreshed = await loadSyncTargets(selectedSellerId);
    if (refreshed) {
      setSyncChannels((prev) =>
        prev.map((channel) => {
          if (channel.state !== 'failed') return channel;
          const recorded = refreshed.find((t) => t.accountId === channel.target.accountId);
          return recorded?.lastSyncError ? { ...channel, error: recorded.lastSyncError } : channel;
        })
      );
    }
  };

  // Backfills one month, account by account. Mirrors runSync but calls the period endpoint,
  // refetches the selected period afterwards and deliberately leaves the sync banners alone
  // (the server records no channel status for a period backfill, PLAN D5).
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
    cancelRef.current = false;
    setSyncCanceled(false);
    setSyncModalOpen(true);
    setIsSyncing(true);
    setError('');
    setSyncChannels(targets.map((t) => ({ target: t, state: 'pending' })));
    setSyncCursor(0);

    let newOrders = 0;
    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) {
        setSyncCanceled(true);
        break;
      }
      setSyncChannels((prev) => markState(prev, i, 'running'));
      try {
        const result = await orderUseCase.syncPeriod(targets[i].accountId, range);
        newOrders += result.newOrders;
        setSyncChannels((prev) => markState(prev, i, 'success'));
      } catch (e) {
        setSyncChannels((prev) => markState(prev, i, 'failed', extractMessage(e)));   // PLAN D9
      }
      setSyncCursor(i + 1);
    }
    setIsSyncing(false);

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
      if (targets.length === 0) {
        setError('동기화할 채널이 없습니다.');
        return;
      }
      await runSync(targets);
    } catch {
      setError('동기화 대상을 불러오지 못했습니다.');
    }
  };

  const handleRetryFailed = () => {
    const failed = syncChannels.filter((c) => c.state === 'failed').map((c) => c.target);
    if (failed.length === 0) return;
    // Retrying a failed backfill re-runs the backfill for that period - routing it through the
    // regular sync would stamp the "last sync" banner with a period run (PLAN D5).
    if (isBackfillRun && backfillPeriodRef.current) {
      runPeriodBackfill(backfillPeriodRef.current, failed);
      return;
    }
    runSync(failed);
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
          onSellerChange={setSelectedSellerId}
          onSearch={handleSearch}
          onSync={handleSync}
          isLoading={isLoading}
          isSyncing={isSyncing}
          resultCount={searchedOrders.length}
          periodOptions={periodOptions}
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          searchField={searchField}
          onSearchFieldChange={handleSearchFieldChange}
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          showStaleNotice={isMonthPeriod(appliedPeriod)}
          lastSyncedAt={lastSyncedAt}
          canDownload={isAdmin}
          onDownload={() => setIsPreviewOpen(true)}
          onOpenConfirm={() => setIsConfirmOpen(true)}
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
              onClick={() => runSync(nonSuccessTargets)}
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
        />

        <ShipmentConfirmModal
          isOpen={isConfirmOpen}
          onClose={(didSucceed) => {
            setIsConfirmOpen(false);
            // Re-run the current search so write-back'd 배송지시 rows show up without a full page reload.
            if (didSucceed) void handleSearch();
          }}
          useCase={shippingLabelUseCase}
        />

        <SyncProgressModal
          open={syncModalOpen}
          channels={syncChannels}
          doneCount={syncCursor}
          isRunning={isSyncing}
          canceled={syncCanceled}
          onCancel={() => { cancelRef.current = true; }}
          onRetryFailed={handleRetryFailed}
          onClose={() => setSyncModalOpen(false)}
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

        <ShippingLabelPreviewModal
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          sellerId={selectedSellerId || undefined}
          isAdmin={isAdmin}
          useCase={shippingLabelUseCase}
        />
    </PageContainer>
  );
}
