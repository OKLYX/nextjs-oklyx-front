'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { ShippingLabelRepositoryImpl } from '@/infrastructure/repositories/ShippingLabelRepositoryImpl';
import { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { SHIPMENT_STATUSES, isFullyCanceled } from '@/domain/entities/OrderEntity';
import type { SyncTarget } from '@/application/dto/OrderDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { useOrderSync } from '@/presentation/hooks/useOrderSync';
import { OrderStatusFilter } from '../../components/OrderStatusFilter';
import { OrderTable } from '../../components/OrderTable';
import { OrderDetailsModal } from '../../components/OrderDetailsModal';
import { ShipmentConfirmModal } from '../../components/ShipmentConfirmModal';
import { ShippingLabelPreviewModal } from '../../components/ShippingLabelPreviewModal';
import { SyncProgressModal } from '../../components/SyncProgressModal';
import { channelOptionLabel } from '../../components/OrderSearchCard';
import type { ChannelOption } from '../../components/OrderSearchCard';
import { ShipmentFilterCard } from './ShipmentFilterCard';

// 주문내역과 같은 값. 공유 모듈로 승격하지 않는다 — 표(OrderTable) diff 0 을 유지하기 위한 지역 상수.
const PAGE_SIZE = 20;

const SHIPMENT_STATUS_LIST = SHIPMENT_STATUSES as readonly string[];

/**
 * 출고관리 컨테이너 — 아직 발송하지 않은 주문(결제완료·상품준비중)의 작업 화면.
 *
 * 주문내역이 조회 화면인 것과 달리 여기는 작업 화면이라 기간·검색이 없고(PLAN 2609_15 D8)
 * 송장 접수시트·발송처리 입구가 여기 하나뿐이다(D4).
 *
 * ⚠️ 표·모달은 주문내역 것을 그대로 재사용한다(D12) — 복사하지 말 것.
 * ⚠️ 동기화 오케스트레이션은 `useOrderSync` 한 벌만 쓴다(D6).
 */
export function ShipmentContainer() {
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  // 접수시트·발송처리·상세 모달이 요구한다. 빠뜨리면 모달을 마운트할 수 없다.
  const shippingLabelUseCase = useMemo(
    () => new ShippingLabelUseCase(new ShippingLabelRepositoryImpl()),
    []
  );

  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  // 채널 셀렉트 옵션이자 동기화 대상. 출고관리는 미발송 주문만 다루므로 대상이 곧 활성 계정이다.
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);   // 서버 응답 원본(필터 전)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [sortKey, setSortKey] = useState<keyof OrderItem | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    const loadSellers = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        // Non-blocking: dropdown falls back to '전체' only
      }
    };
    loadSellers();
  }, [sellerUseCase]);

  // 동기화 대상 = 채널 셀렉트 옵션. 조회 실패는 옵션만 비우고 화면을 막지 않는다.
  // 조회한 행을 반환해 호출부가 두 번 부르지 않게 한다(사유 보강에서 재사용).
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

  // 기간 파라미터를 보내지 않는다(D8) — 서버 기본 창(14일)이 곧 출고 대상 범위다.
  // useOrderSync 보다 먼저 선언한다(useCallback 은 TDZ — 아래에 두면 참조 불가).
  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const result = await orderUseCase.getOrders(selectedSellerId || undefined);
      setOrders(result);
      setHasSearched(true);
      setCurrentPage(0);
      await loadSyncTargets(selectedSellerId);
    } catch {
      setError('출고 대상 조회에 실패했습니다. 다시 시도해주세요.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderUseCase, selectedSellerId, loadSyncTargets]);

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

  // 출고관리는 "아직 안 보낸 주문"만 다룬다 → 결제완료·상품준비중만 조회(쿠팡 왕복 6회 → 2회).
  // 배송지시 이후 상태는 주문내역 동기화(전 상태)가 따라잡는다.
  const {
    runSync, applyChannelErrors, failedTargets,
    isSyncing, syncChannels, syncCursor, syncCanceled, syncModalOpen, lastSyncedAt,
    cancelSync, closeSyncModal,
  } = useOrderSync({ onAfterSync: load, onSyncSettled: handleSyncSettled, scope: 'ACTIVE' });

  // 최초 진입 로드(주문내역과 같은 형태). 이후 재조회는 [조회]·동기화·모달 성공이 담당한다.
  // ⚠️ `load()` 를 직접 부르면 lint(set-state-in-effect) 에 걸린다 — 인라인 async 함수로 감싼다.
  useEffect(() => {
    const loadInitialOrders = async () => {
      try {
        setIsLoading(true);
        const result = await orderUseCase.getOrders();
        setOrders(result);
        setHasSearched(true);
        await loadSyncTargets('');
      } catch {
        setError('출고 대상 조회에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialOrders();
  }, [orderUseCase, loadSyncTargets]);

  const channelOptions = useMemo<ChannelOption[]>(
    () => syncTargets.map((t) => ({
      accountId: t.accountId,
      label: channelOptionLabel(t.accountId, t.accountAlias),
      syncable: true,
    })),
    [syncTargets]
  );

  // 필터 → 정렬 → 페이지. 표시 목록은 파생값으로만 만든다(별도 state 금지 — 두 벌이 되면 어긋난다).
  // 전량취소는 status 가 ACCEPT 그대로라 isFullyCanceled 로 따로 뺀다(D13).
  const visible = useMemo(() => orders
    .filter((o) => SHIPMENT_STATUS_LIST.includes(o.status))
    .filter((o) => !isFullyCanceled(o))
    .filter((o) => !selectedAccountId || o.marketplaceAccountId === selectedAccountId)
    .filter((o) => !selectedStatus || o.status === selectedStatus),
    [orders, selectedAccountId, selectedStatus]);

  // 칩 카운트는 탭 선택 전 목록으로 센다(선택해도 다른 칩 건수가 0 이 되지 않게).
  const statusCounts = useMemo(() => orders
    .filter((o) => SHIPMENT_STATUS_LIST.includes(o.status))
    .filter((o) => !isFullyCanceled(o))
    .filter((o) => !selectedAccountId || o.marketplaceAccountId === selectedAccountId)
    .reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {}),
    [orders, selectedAccountId]);

  const sorted = useMemo(() => {
    if (sortKey == null) return visible;
    const copy = [...visible];
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
  }, [visible, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const paged = useMemo(
    () => sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [sorted, currentPage]
  );

  const handleSync = async () => {
    setError('');
    try {
      const targets = await orderUseCase.getSyncTargets(selectedSellerId || undefined);
      // 채널이 선택돼 있으면 그 대상 1개만 돌린다(D7).
      const scoped = selectedAccountId === ''
        ? targets
        : targets.filter((t) => t.accountId === selectedAccountId);
      if (scoped.length === 0) {
        setError('동기화할 채널이 없습니다.');
        return;
      }
      await runSync(scoped);
    } catch {
      setError('동기화 대상을 불러오지 못했습니다.');
    }
  };

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

  const handleSort = (key: keyof OrderItem) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(0);
  };

  // 결과 0건은 에러가 아니다 — OrderTable 의 '조회 결과가 없습니다.' 대신 출고 문구를 쓴다(표 diff 0).
  const showEmpty = hasSearched && !isLoading && error === '' && sorted.length === 0;

  return (
    <PageContainer contentClassName="max-w-7xl mx-auto space-y-6">
      <ShipmentFilterCard
        sellers={sellers}
        selectedSellerId={selectedSellerId}
        onSellerChange={handleSellerChange}
        channelOptions={channelOptions}
        selectedAccountId={selectedAccountId}
        onAccountChange={handleAccountChange}
        onSearch={() => void load()}
        onSync={handleSync}
        isLoading={isLoading}
        isSyncing={isSyncing}
        resultCount={visible.length}
        lastSyncedAt={lastSyncedAt}
        canDownload={isAdmin}
        onDownload={() => setIsPreviewOpen(true)}
        onOpenConfirm={() => setIsConfirmOpen(true)}
      />

      <OrderStatusFilter
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        counts={statusCounts}
        canceledCount={0}
        statuses={SHIPMENT_STATUSES}
        showCanceledChip={false}
      />

      {showEmpty ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          발송할 주문이 없습니다.
        </div>
      ) : (
        <OrderTable
          orders={paged}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={setSelectedOrder}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* key remount resets the modal's sheet state when the order changes or the modal closes
          (it is always rendered, so it never unmounts on its own). */}
      <OrderDetailsModal
        key={selectedOrder?.id ?? 'none'}
        order={selectedOrder}
        onClose={(didSucceed) => {
          setSelectedOrder(null);
          if (didSucceed) void load();
        }}
        isAdmin={isAdmin}
        useCase={shippingLabelUseCase}
      />

      <ShipmentConfirmModal
        isOpen={isConfirmOpen}
        onClose={(didSucceed) => {
          setIsConfirmOpen(false);
          // 발송처리에 성공하면 배송지시로 바뀐 행이 목록에서 빠져야 한다.
          if (didSucceed) void load();
        }}
        useCase={shippingLabelUseCase}
      />

      <ShippingLabelPreviewModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        sellerId={selectedSellerId || undefined}
        isAdmin={isAdmin}
        useCase={shippingLabelUseCase}
      />

      <SyncProgressModal
        open={syncModalOpen}
        channels={syncChannels}
        doneCount={syncCursor}
        isRunning={isSyncing}
        canceled={syncCanceled}
        onCancel={cancelSync}
        onRetryFailed={() => void runSync(failedTargets)}
        onClose={closeSyncModal}
      />
    </PageContainer>
  );
}
