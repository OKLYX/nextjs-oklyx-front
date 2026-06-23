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
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import type { PurchaseList, PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import type {
  RecordPurchaseRequest,
  AddManualItemRequest,
} from '@/application/dto/PurchaseListDTOs';
import { PurchaseListToolbar } from './PurchaseListToolbar';
import { PurchaseListTable } from './PurchaseListTable';
import { UnmappedOrdersSection } from './UnmappedOrdersSection';
import { AddManualItemModal } from './AddManualItemModal';
import { PurchaseTabs, type PurchaseTab } from './PurchaseTabs';
import { CompletedPurchaseTable } from './CompletedPurchaseTable';
import { CompletedPurchaseFilter } from './CompletedPurchaseFilter';
import { PageContainer } from '@/presentation/components/PageContainer';

// 로컬 타임존 기준 오늘(YYYY-MM-DD). toISOString(UTC)은 KST에서 하루 어긋날 수 있어 직접 조립.
const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function PurchaseListContainer() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const [purchaseList, setPurchaseList] = useState<PurchaseList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  // productId -> 이미지 프록시 URL (없으면 null). 구매목록 응답엔 이미지가 없어 상품 상세로 보강.
  const [productImages, setProductImages] = useState<Record<number, string | null>>({});
  // 탭(구매목록 / 구매완료내역조회) 상태. 완료내역은 읽기 전용이라 최초 진입 시 1회 로드.
  const [activeTab, setActiveTab] = useState<PurchaseTab>('list');
  const [completedItems, setCompletedItems] = useState<PurchaseListItem[]>([]);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [isCompletedLoading, setIsCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');
  const [expandedCompletedId, setExpandedCompletedId] = useState<number | null>(null);
  // 완료내역 필터(판매자 + 구매일 기간). 기본 조회는 오늘. 날짜를 비우면 전체. 조회 버튼으로 적용.
  const [completedSellerId, setCompletedSellerId] = useState<number | null>(null);
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
          return [item.productId, getImageUrl(product.imageUrl, item.productId)] as const;
        } catch {
          return [item.productId, null] as const;
        }
      })
    );
    // 목록/완료내역이 같은 맵을 공유하므로 덮어쓰지 않고 병합.
    setProductImages((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  const loadList = async (sid: number | null) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await purchaseListUseCase.getList(sid ?? undefined);
      setPurchaseList(result);
      loadImages(result.items);
    } catch {
      setError('구매 목록 조회에 실패했습니다. 다시 시도해주세요.');
      setPurchaseList(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompleted = async (
    sid: number | null = completedSellerId,
    from: string = completedFrom,
    to: string = completedTo
  ) => {
    try {
      setIsCompletedLoading(true);
      setCompletedError('');
      const result = await purchaseListUseCase.getCompletedList(
        sid ?? undefined,
        from || undefined,
        to || undefined
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
  };

  const handleCompletedReset = () => {
    const today = todayStr();
    setCompletedSellerId(null);
    setCompletedFrom(today);
    setCompletedTo(today);
    setExpandedCompletedId(null);
    loadCompleted(null, today, today);
  };

  // 진입 시 셀러 목록 + 전체 구매 목록 로드
  useEffect(() => {
    const init = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        setSellers([]);
      }
      await loadList(null);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSellerChange = (sid: number | null) => {
    setSellerId(sid);
    setExpandedProductId(null);
    loadList(sid);
  };

  const handleExtract = async () => {
    try {
      setIsExtracting(true);
      setError('');
      setActionError('');
      // extract 응답이 곧 새 목록 — 추가 GET 불필요
      const result = await purchaseListUseCase.extract(sellerId ?? undefined);
      setPurchaseList(result);
      loadImages(result.items);
    } catch {
      setError('동기화(추출)에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsExtracting(false);
    }
  };

  // 주문내역 동기화: 마켓플레이스에서 최신 주문을 가져온 뒤(syncOrders),
  // 그 결과를 반영하도록 구매목록을 재추출(extract)한다. 구매목록은 주문 동기화가
  // 끝나야 조회 가능하므로 한 번의 클릭으로 동기화→재구성을 함께 처리한다.
  const handleSyncOrders = async () => {
    try {
      setIsSyncingOrders(true);
      setError('');
      setActionError('');
      setSyncMessage('');
      const sync = await orderUseCase.syncOrders({ sellerId: sellerId ?? undefined });
      const result = await purchaseListUseCase.extract(sellerId ?? undefined);
      setPurchaseList(result);
      loadImages(result.items);
      setSyncMessage(
        `주문내역 동기화 완료 — 신규 ${sync.newOrders}건, 수정 ${sync.updatedOrders}건, 취소 ${sync.canceledUpdated}건`
      );
    } catch {
      setError('주문내역 동기화에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // mutation 후 목록 재조회(=invalidate). 잔여 0이 된 라인/상품은 응답에서 빠진다.
  const refresh = () => loadList(sellerId);

  const handleRecordPurchase = async (itemId: number, request: RecordPurchaseRequest) => {
    setActionError('');
    try {
      await purchaseListUseCase.recordPurchase(itemId, request);
      await refresh();
    } catch (err) {
      setActionError('구매 기록 저장에 실패했습니다.');
      throw err;
    }
  };

  const handleAdjustManual = async (itemId: number, manualQty: number) => {
    setActionError('');
    try {
      await purchaseListUseCase.adjustManualQty(itemId, { manualQty });
      await refresh();
    } catch (err) {
      setActionError('수동수량 변경에 실패했습니다.');
      throw err;
    }
  };

  const handleAddManual = async (request: AddManualItemRequest) => {
    await purchaseListUseCase.addManualItem(request);
    setIsManualModalOpen(false);
    await refresh();
  };

  const handleToggle = (productId: number) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  };

  return (
    <PageContainer contentClassName="max-w-7xl mx-auto space-y-6">
      <PurchaseTabs activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === 'list' && (
          <>
            <PurchaseListToolbar
              sellers={sellers}
              sellerId={sellerId}
              onSellerChange={handleSellerChange}
              onExtract={handleExtract}
              isExtracting={isExtracting}
              onAddManualClick={() => setIsManualModalOpen(true)}
              onSyncOrders={handleSyncOrders}
              isSyncingOrders={isSyncingOrders}
            />

            {syncMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {syncMessage}
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {actionError}
              </div>
            )}

            <PurchaseListTable
              items={purchaseList?.items ?? []}
              productImages={productImages}
              isLoading={isLoading}
              error={error}
              expandedProductId={expandedProductId}
              onToggle={handleToggle}
              onRecordPurchase={handleRecordPurchase}
              onAdjustManual={handleAdjustManual}
            />

            <UnmappedOrdersSection
              orders={purchaseList?.unmappedOrders ?? []}
              isLoading={isLoading}
            />
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <CompletedPurchaseFilter
              sellers={sellers}
              sellerId={completedSellerId}
              from={completedFrom}
              to={completedTo}
              isLoading={isCompletedLoading}
              onSellerChange={setCompletedSellerId}
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
              productImages={productImages}
              isLoading={isCompletedLoading}
              error={completedError}
              expandedProductId={expandedCompletedId}
              onToggle={(productId) =>
                setExpandedCompletedId((prev) => (prev === productId ? null : productId))
              }
            />
          </>
        )}

      <AddManualItemModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleAddManual}
      />
    </PageContainer>
  );
}
