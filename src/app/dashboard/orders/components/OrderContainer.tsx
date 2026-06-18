'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import type { OrderSyncResponse } from '@/application/dto/OrderDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { OrderSearchCard } from './OrderSearchCard';
import { OrderStatusFilter } from './OrderStatusFilter';
import { OrderTable } from './OrderTable';
import { OrderDetailsModal } from './OrderDetailsModal';

const PAGE_SIZE = 20;
const LAST_SYNCED_AT_KEY = 'oklyx_order_last_synced_at';

export function OrderContainer() {
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

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

  // Count orders per status for the filter button badges (unaffected by selection)
  const statusCounts = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  // Apply the status filter before sorting/paging; null status shows all
  const filteredOrders = useMemo(
    () => (selectedStatus == null ? orders : orders.filter((o) => o.status === selectedStatus)),
    [orders, selectedStatus]
  );

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
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
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
      </div>
    </div>
  );
}
