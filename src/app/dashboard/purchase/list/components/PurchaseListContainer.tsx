'use client';

import { useEffect, useMemo, useState } from 'react';
import { PurchaseListRepositoryImpl } from '@/infrastructure/repositories/PurchaseListRepositoryImpl';
import { PurchaseListUseCase } from '@/application/usecases/PurchaseListUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { GetProductDetailUseCase } from '@/application/usecases/GetProductDetailUseCase';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { usePurchaseSettingStore } from '@/infrastructure/stores/purchaseSettingStore';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { PurchaseList, PurchaseListItem, PurchaseShare } from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { AddManualItemRequest } from '@/application/dto/PurchaseListDTOs';
import { PurchaseListToolbar } from './PurchaseListToolbar';
import { PurchaseListTable } from './PurchaseListTable';
import { UnmappedOrdersSection } from './UnmappedOrdersSection';
import { AddManualItemModal } from './AddManualItemModal';
import { PurchaseTabs, type PurchaseTab } from './PurchaseTabs';
import { CompletedPurchaseTable } from './CompletedPurchaseTable';
import { CompletedPurchaseFilter } from './CompletedPurchaseFilter';
import { SkipReasonModal } from './SkipReasonModal';
import { shareKey, type ShareActions, type ShareCheckStatus } from './purchaseShareUi';
import { PageContainer } from '@/presentation/components/PageContainer';

// 로컬 타임존 기준 오늘(YYYY-MM-DD). toISOString(UTC)은 KST에서 하루 어긋날 수 있어 직접 조립.
const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function PurchaseListContainer() {
  // 🔴 The seller filter narrows the view only — sync and extract always cover every seller (FEATURE_2610_09 D4 · D19).
  const [sellers, setSellers] = useState<Seller[]>([]);
  // D5: '' = 「전체」. Every visit starts at 「전체」 (exactly one seller: at that seller, filter hidden — D53) and is not stored.
  // Both tabs share it.
  const [filterSellerId, setFilterSellerId] = useState('');
  // D5: the other tab reloads on its next entry after a filter change or an action.
  const [listStale, setListStale] = useState(false);
  const [pendingShareKey, setPendingShareKey] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<{ productId: number; productName: string; share: PurchaseShare } | null>(
    null
  );
  const stockLinked = usePurchaseSettingStore((state) => state.stockLinked);
  const [purchaseList, setPurchaseList] = useState<PurchaseList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  // productId -> 이미지 프록시 URL (없으면 null). 구매목록 응답엔 이미지가 없어 상품 상세로 보강.
  const [productImages, setProductImages] = useState<Record<number, string | null>>({});
  // Tab (「구매목록」 / 「구매완료내역조회」). The completed tab loads on entry while it is not loaded (D5 marks it stale).
  const [activeTab, setActiveTab] = useState<PurchaseTab>('list');
  const [completedItems, setCompletedItems] = useState<PurchaseListItem[]>([]);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [isCompletedLoading, setIsCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');
  const [expandedCompletedId, setExpandedCompletedId] = useState<number | null>(null);
  // Completed filter (processing-day range, D63). Defaults to today; empty dates = all; applied by [조회].
  const [completedFrom, setCompletedFrom] = useState(todayStr());
  const [completedTo, setCompletedTo] = useState(todayStr());

  const purchaseListUseCase = useMemo(() => {
    const repository = new PurchaseListRepositoryImpl();
    return new PurchaseListUseCase(repository);
  }, []);

  const sellerUseCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  const getProductDetailUseCase = useMemo(() => {
    const repository = new ProductRepositoryImpl();
    return new GetProductDetailUseCase(repository);
  }, []);

  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);

  const loadImages = async (items: PurchaseListItem[]) => {
    const entries = await Promise.all(
      items.map(async (item) => {
        try {
          const product = await getProductDetailUseCase.getProduct(item.productId);
          // 상품조회 목록과 같은 해석기를 쓴다(FEATURE 2609 상품목록 썸네일).
          // `getImageUrl` 은 productId 가 있으면 항상 백엔드 프록시로 떨어져,
          // 이미지가 S3 에 있는 dev/prod 에서는 썸네일이 뜨지 않았다.
          return [item.productId, getProductThumbUrl(product.imageUrl, item.productId)] as const;
        } catch {
          return [item.productId, null] as const;
        }
      })
    );
    // 목록/완료내역이 같은 맵을 공유하므로 덮어쓰지 않고 병합.
    setProductImages((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  const toSellerParam = (value: string) => (value ? Number(value) : undefined);

  const loadList = async (sellerValue: string = filterSellerId) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await purchaseListUseCase.getList(toSellerParam(sellerValue));
      setPurchaseList(result);
      loadImages([...result.items, ...result.skippedToday]);
    } catch {
      setError('구매 목록 조회에 실패했습니다. 다시 시도해주세요.');
      setPurchaseList(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompleted = async (
    from: string = completedFrom,
    to: string = completedTo,
    sellerValue: string = filterSellerId
  ) => {
    try {
      setIsCompletedLoading(true);
      setCompletedError('');
      const result = await purchaseListUseCase.getCompletedList(
        from || undefined,
        to || undefined,
        toSellerParam(sellerValue)
      );
      setCompletedItems(result);
      loadImages(result);
    } catch {
      setCompletedError('구매 완료 내역 조회에 실패했습니다. 다시 시도해주세요.');
      setCompletedItems([]);
    } finally {
      setIsCompletedLoading(false);
    }
  };

  const handleTabChange = (tab: PurchaseTab) => {
    setActiveTab(tab);
    if (tab === 'completed' && !completedLoaded) {
      setCompletedLoaded(true);
      loadCompleted();
    }
    if (tab === 'list' && listStale) {
      setListStale(false);
      loadList();
    }
  };

  // D5 · D10: reload the current tab, mark the other one stale, fold the opened rows (new intake default).
  const handleFilterChange = (value: string) => {
    setFilterSellerId(value);
    setExpandedProductId(null);
    setExpandedCompletedId(null);
    if (activeTab === 'list') {
      setCompletedLoaded(false);
      loadList(value);
    } else {
      setListStale(true);
      loadCompleted(completedFrom, completedTo, value);
    }
  };

  const handleCompletedReset = () => {
    const today = todayStr();
    setCompletedFrom(today);
    setCompletedTo(today);
    setExpandedCompletedId(null);
    loadCompleted(today, today);
  };

  // 진입 시 셀러 목록 + 구매 목록 로드
  useEffect(() => {
    const init = async () => {
      let loaded: Seller[];
      try {
        loaded = await sellerUseCase.getAll();
      } catch {
        loaded = [];
      }
      setSellers(loaded);
      // D53: exactly one seller = the screen with that seller picked (the filter is hidden).
      const initialSellerId = loaded.length === 1 ? String(loaded[0].id) : '';
      setFilterSellerId(initialSellerId);
      await loadList(initialSellerId);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주문내역 동기화: 마켓플레이스에서 최신 주문을 가져온 뒤(syncOrders),
  // 그 결과를 반영하도록 구매목록을 재추출(extract)한다. 구매목록은 주문 동기화가
  // 끝나야 조회 가능하므로 한 번의 클릭으로 동기화→재구성을 함께 처리한다.
  const handleSyncOrders = async () => {
    try {
      setIsSyncingOrders(true);
      setError('');
      setSyncMessage('');
      const sync = await orderUseCase.syncOrders();
      await purchaseListUseCase.extract();
      // D4: the extract answers with 「전체」 — reload with the current filter instead. D85 may add 「필요 0」 rows.
      await loadList();
      setCompletedLoaded(false);
      // This screen calls every channel at once, so only the totals come back - no per-channel row.
      // Appended only when something was skipped (2609_48 D5).
      const skippedPart = sync.skippedAccounts > 0
        ? ` · ${sync.skippedAccounts}채널은 이미 동기화 중이라 건너뜀`
        : '';
      setSyncMessage(
        `주문내역 동기화 완료 — 신규 ${sync.newOrders}건, 수정 ${sync.updatedOrders}건, 취소 ${sync.canceledUpdated}건${skippedPart}`
      );
    } catch {
      setError('주문내역 동기화에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Reload after a check-in or a manual line change. A manual line change can move a share across tabs (D60 · D80),
  // so the other tab reloads on its next entry too (D5).
  const handleRecorded = () => {
    setCompletedLoaded(false);
    return loadList();
  };

  const handleCompletedRecorded = () => {
    setListStale(true);
    return loadCompleted();
  };

  // After [매입 완료] · [오늘 매입 안 함] · undo: reload the current tab, the other tab on its next entry (D5).
  const reloadAfterShareAction = async () => {
    if (activeTab === 'list') {
      setCompletedLoaded(false);
      await loadList();
    } else {
      setListStale(true);
      await loadCompleted();
    }
  };

  const runShareAction = async (key: string, action: () => Promise<void>, fallback: string) => {
    setPendingShareKey(key);
    try {
      await action();
      await reloadAfterShareAction();
    } catch (err) {
      toast.error(extractErrorMessage(err, fallback));
    } finally {
      setPendingShareKey(null);
    }
  };

  const shareActions: ShareActions = {
    pendingKey: pendingShareKey,
    onCheck: (productId: number, share: PurchaseShare, status: ShareCheckStatus) =>
      void runShareAction(
        shareKey(productId, share.sellerId),
        () => purchaseListUseCase.check({ productId, sellerId: share.sellerId, status }),
        '처리하지 못했습니다.'
      ),
    onAskSkip: (productId: number, share: PurchaseShare) => {
      const all = [...(purchaseList?.items ?? []), ...(purchaseList?.skippedToday ?? [])];
      const productName = all.find((item) => item.productId === productId)?.productName ?? '';
      setSkipTarget({ productId, productName, share });
    },
    onCancelCheck: (productId: number, share: PurchaseShare) =>
      void runShareAction(
        shareKey(productId, share.sellerId),
        () => purchaseListUseCase.cancelCheck(share.checkId as number),
        '되돌리지 못했습니다.'
      ),
  };

  const handleSkipPick = async (status: 'TOMORROW' | 'NOT_NEEDED') => {
    if (!skipTarget) return;
    const { productId, share } = skipTarget;
    await runShareAction(
      shareKey(productId, share.sellerId),
      () => purchaseListUseCase.check({ productId, sellerId: share.sellerId, status }),
      '처리하지 못했습니다.'
    );
    setSkipTarget(null);
  };

  const handleAddManual = async (request: AddManualItemRequest) => {
    await purchaseListUseCase.addManualItem(request);
    setIsManualModalOpen(false);
    setCompletedLoaded(false);
    await loadList();
  };

  const handleToggle = (productId: number) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  };

  const filterSellerNumber = filterSellerId ? Number(filterSellerId) : null;

  return (
    <PageContainer title="구매목록">
      <PurchaseTabs activeTab={activeTab} onChange={handleTabChange} />

      {/* D1 · D5 · D53: seller view filter under the tabs, hidden when there is exactly one seller. */}
      {sellers.length !== 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="purchase-seller-filter" className="text-sm text-gray-700">
            판매자
          </label>
          <select
            id="purchase-seller-filter"
            value={filterSellerId}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>
      )}

        {activeTab === 'list' && (
          <>
            <PurchaseListToolbar
              onAddManualClick={() => setIsManualModalOpen(true)}
              onSyncOrders={handleSyncOrders}
              isSyncingOrders={isSyncingOrders}
            />

            {syncMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {syncMessage}
              </div>
            )}

            <PurchaseListTable
              variant="list"
              items={purchaseList?.items ?? []}
              sellers={sellers}
              filterSellerId={filterSellerNumber}
              stockLinked={stockLinked === true}
              productImages={productImages}
              isLoading={isLoading}
              error={error}
              expandedProductId={expandedProductId}
              onToggle={handleToggle}
              onRecorded={handleRecorded}
              shareActions={shareActions}
            />

            {/* D67: 「오늘 넘김」 below the list, only when something was put off today. */}
            {!isLoading && !error && (purchaseList?.skippedToday.length ?? 0) > 0 && (
              <PurchaseListTable
                variant="skipped"
                items={purchaseList?.skippedToday ?? []}
                sellers={sellers}
                filterSellerId={filterSellerNumber}
                stockLinked={stockLinked === true}
                productImages={productImages}
                isLoading={false}
                error=""
                expandedProductId={expandedProductId}
                onToggle={handleToggle}
                onRecorded={handleRecorded}
                shareActions={shareActions}
              />
            )}

            <UnmappedOrdersSection
              orders={purchaseList?.unmappedOrders ?? []}
              isLoading={isLoading}
            />
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <CompletedPurchaseFilter
              from={completedFrom}
              to={completedTo}
              isLoading={isCompletedLoading}
              onFromChange={setCompletedFrom}
              onToChange={setCompletedTo}
              onApply={() => {
                setExpandedCompletedId(null);
                loadCompleted();
              }}
              onReset={handleCompletedReset}
            />

            <CompletedPurchaseTable
              items={completedItems}
              sellers={sellers}
              filterSellerId={filterSellerNumber}
              stockLinked={stockLinked === true}
              productImages={productImages}
              isLoading={isCompletedLoading}
              error={completedError}
              expandedProductId={expandedCompletedId}
              onToggle={(productId) =>
                setExpandedCompletedId((prev) => (prev === productId ? null : productId))
              }
              onRecorded={handleCompletedRecorded}
              shareActions={shareActions}
            />
          </>
        )}

      <AddManualItemModal
        isOpen={isManualModalOpen}
        sellers={sellers}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleAddManual}
      />

      <SkipReasonModal
        target={skipTarget ? `${skipTarget.productName} · ${skipTarget.share.sellerName}` : null}
        isLoading={skipTarget != null && pendingShareKey === shareKey(skipTarget.productId, skipTarget.share.sellerId)}
        onPick={(status) => void handleSkipPick(status)}
        onClose={() => setSkipTarget(null)}
      />
    </PageContainer>
  );
}
