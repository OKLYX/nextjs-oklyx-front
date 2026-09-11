'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type {
  PurchaseCandidate,
  ReturnCandidate,
  StockMovement,
} from '@/domain/entities/StockEntity';
import { StockInOutForm, type MovementPrefill } from './StockInOutForm';
import { StockInOutTable } from './StockInOutTable';
import { PurchaseCandidateTable } from './PurchaseCandidateTable';
import { ReturnCandidateTable } from './ReturnCandidateTable';

/**
 * 입고 · 조정 화면 (FEATURE_2609_28 / PLAN D6~D10 · D22).
 *
 * 구성 = 기록 폼 + 입고 대기(구매기록) + 반품 대기(클레임) + 최근 이력.
 * 두 대기 목록은 폼의 참조(purchaseRecordId · orderClaimId)를 채우는 선택지다 — 그 값 없이는
 * 매입 입고와 반품입고를 아예 기록할 수 없다.
 */
export function StockInOutContainer() {
  const stockUseCase = useMemo(() => new StockUseCase(new StockRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [prefill, setPrefill] = useState<MovementPrefill | null>(null);

  const [purchaseCandidates, setPurchaseCandidates] = useState<PurchaseCandidate[]>([]);
  const [isPurchaseLoading, setIsPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const [returnCandidates, setReturnCandidates] = useState<ReturnCandidate[]>([]);
  const [isReturnLoading, setIsReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySellerId, setHistorySellerId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  // 날짜를 비우면 서버 기본값(최근 30일)이 적용된다 — 화면이 창을 다시 계산하지 않는다.
  const loadHistory = async (
    sellerId: string = historySellerId,
    from: string = historyFrom,
    to: string = historyTo
  ) => {
    setIsHistoryLoading(true);
    setHistoryError('');
    try {
      setMovements(
        await stockUseCase.getHistory({
          sellerId: sellerId ? Number(sellerId) : undefined,
          from: from || undefined,
          to: to || undefined,
        })
      );
    } catch {
      setHistoryError('재고 이력 조회에 실패했습니다.');
      setMovements([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadPurchaseCandidates = async () => {
    setIsPurchaseLoading(true);
    setPurchaseError('');
    try {
      setPurchaseCandidates(await stockUseCase.getPurchaseCandidates());
    } catch {
      setPurchaseError('입고 대기 목록 조회에 실패했습니다.');
      setPurchaseCandidates([]);
    } finally {
      setIsPurchaseLoading(false);
    }
  };

  const loadReturnCandidates = async () => {
    setIsReturnLoading(true);
    setReturnError('');
    try {
      setReturnCandidates(await stockUseCase.getReturnCandidates());
    } catch {
      setReturnError('반품 대기 목록 조회에 실패했습니다.');
      setReturnCandidates([]);
    } finally {
      setIsReturnLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        setSellers([]);
      }
      await Promise.all([loadPurchaseCandidates(), loadReturnCandidates(), loadHistory()]);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 기록 1건이 세 목록을 모두 움직인다(대기 잔여 · 이력).
  const handleRecorded = async () => {
    await Promise.all([loadPurchaseCandidates(), loadReturnCandidates(), loadHistory()]);
  };

  // 응답에 sellerId 가 없어 이름으로 맞춘다. 못 찾으면 비워 두고 사람이 고른다
  // — 판매자가 구매기록과 다르면 서버가 400 으로 막는다.
  const sellerIdByName = (sellerName: string) =>
    sellers.find((seller) => seller.sellerName === sellerName)?.id;

  const handleSelectPurchase = (candidate: PurchaseCandidate) => {
    setPrefill({
      key: Date.now(),
      movementType: 'STOCK_IN',
      reason: 'PURCHASE',
      productId: candidate.productId,
      productName: candidate.productName,
      sellerId: sellerIdByName(candidate.sellerName),
      quantity: candidate.remainingQty > 0 ? candidate.remainingQty : 1,
      purchaseRecordId: candidate.purchaseRecordId,
      purchaseRecordLabel: `#${candidate.purchaseRecordId} · ${candidate.purchasedOn} · ${candidate.productName}`,
    });
  };

  const handleSelectReturn = (candidate: ReturnCandidate) => {
    setPrefill({
      key: Date.now(),
      movementType: 'RETURN_IN',
      quantity: candidate.remainingQty > 0 ? candidate.remainingQty : 1,
      orderClaimId: candidate.orderClaimId,
      orderClaimLabel: `#${candidate.orderClaimId} · ${candidate.externalOrderId ?? '주문 미매칭'} · ${candidate.itemName ?? ''}`,
    });
  };

  return (
    <PageContainer title="입고 조정">
      <div className="bg-white rounded-lg shadow">
        {/* ⚠️ key remount 로 프리필을 적용한다 — effect 안의 동기 setState 는 lint 가 막는다. */}
        <StockInOutForm
          key={prefill?.key ?? 'blank'}
          sellers={sellers}
          prefill={prefill}
          onRecorded={handleRecorded}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <PurchaseCandidateTable
          candidates={purchaseCandidates}
          isLoading={isPurchaseLoading}
          error={purchaseError}
          onSelect={handleSelectPurchase}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <ReturnCandidateTable
          candidates={returnCandidates}
          isLoading={isReturnLoading}
          error={returnError}
          onSelect={handleSelectReturn}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <StockInOutTable
          movements={movements}
          sellers={sellers}
          sellerId={historySellerId}
          from={historyFrom}
          to={historyTo}
          isLoading={isHistoryLoading}
          error={historyError}
          onSellerChange={setHistorySellerId}
          onFromChange={setHistoryFrom}
          onToChange={setHistoryTo}
          onSearch={() => loadHistory()}
        />
      </div>
    </PageContainer>
  );
}
