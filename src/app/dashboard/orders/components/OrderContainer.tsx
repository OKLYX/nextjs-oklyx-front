'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { ShippingLabelRepositoryImpl } from '@/infrastructure/repositories/ShippingLabelRepositoryImpl';
import { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { CANCELED_FILTER, isFullyCanceled } from '@/domain/entities/OrderEntity';
import type { OrderSyncResponse } from '@/application/dto/OrderDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { OrderSearchCard } from './OrderSearchCard';
import { OrderStatusFilter } from './OrderStatusFilter';
import { OrderTable } from './OrderTable';
import { OrderDetailsModal } from './OrderDetailsModal';
import { ShipmentConfirmModal } from './ShipmentConfirmModal';

const PAGE_SIZE = 20;
const LAST_SYNCED_AT_KEY = 'oklyx_order_last_synced_at';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
      } catch {
        setError('주문 조회에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialOrders();
  }, [orderUseCase]);

  // Count orders per status for the filter button badges (unaffected by selection).
  // Fully-canceled orders are excluded here and counted separately below.
  const statusCounts = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      if (isFullyCanceled(order)) return acc;
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  // Fully-canceled orders (orderCount === cancelCount) surfaced under the 취소항목 chip
  const canceledCount = useMemo(() => orders.filter(isFullyCanceled).length, [orders]);

  // Apply the selected filter before sorting/paging:
  // - CANCELED_FILTER: only fully-canceled orders
  // - a status code: that status, excluding fully-canceled ones
  // - null: all orders except fully-canceled (those live under 취소항목)
  const filteredOrders = useMemo(() => {
    if (selectedStatus === CANCELED_FILTER) return orders.filter(isFullyCanceled);
    if (selectedStatus == null) return orders.filter((o) => !isFullyCanceled(o));
    return orders.filter((o) => o.status === selectedStatus && !isFullyCanceled(o));
  }, [orders, selectedStatus]);

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
      const result = await orderUseCase.getOrders(selectedSellerId || undefined);
      setOrders(result);
      setHasSearched(true);
      setCurrentPage(0);
    } catch {
      setError('주문 조회에 실패했습니다. 다시 시도해주세요.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setError('');
      const result = await orderUseCase.syncOrders({ sellerId: selectedSellerId || undefined });
      setOrders(result.orders);
      setSyncResult(result);
      setLastSyncedAt(result.syncedAt);
      localStorage.setItem(LAST_SYNCED_AT_KEY, result.syncedAt);
      setHasSearched(true);
      setCurrentPage(0);
    } catch {
      setError('주문 동기화에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Server queries Coupang INSTRUCT orders live to build the sheet — unrelated to the on-screen filter.
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError('');
      const blob = await shippingLabelUseCase.downloadSpreadsheet(selectedSellerId || undefined);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `주문목록_${today}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('주문목록 다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
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
          resultCount={orders.length}
          lastSyncedAt={lastSyncedAt}
          canDownload={isAdmin}
          isDownloading={isDownloading}
          onDownload={handleDownload}
          onOpenConfirm={() => setIsConfirmOpen(true)}
        />

        {syncResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            동기화 완료 — 신규 {syncResult.newOrders}건, 수정 {syncResult.updatedOrders}건, 취소 {syncResult.canceledUpdated}건
          </div>
        )}

        <OrderStatusFilter
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          counts={statusCounts}
          canceledCount={canceledCount}
        />

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

        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

        <ShipmentConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          useCase={shippingLabelUseCase}
        />
    </PageContainer>
  );
}
