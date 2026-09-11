'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { StockBalance, StockMovement } from '@/domain/entities/StockEntity';
import { StockSearchForm } from './StockSearchForm';
import { StockSearchTable, balanceKey } from './StockSearchTable';

/**
 * 재고 조회 화면 (FEATURE_2609_28 / PLAN D14 · 2609_29 D5).
 *
 * 잔량은 (물품 × 판매자) 단위 서버 집계다. 행을 누르면 그 조합의 이력이 아래로 펼쳐진다.
 */
export function StockSearchContainer() {
  const stockUseCase = useMemo(() => new StockUseCase(new StockRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [keyword, setKeyword] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadBalances = async (nextKeyword: string = keyword, nextSellerId: string = sellerId) => {
    setIsLoading(true);
    setError('');
    setExpandedKey(null);
    try {
      setBalances(
        await stockUseCase.getBalances({
          keyword: nextKeyword.trim() || undefined,
          sellerId: nextSellerId ? Number(nextSellerId) : undefined,
        })
      );
    } catch {
      setError('재고 조회에 실패했습니다.');
      setBalances([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        setSellers([]);
      }
      await loadBalances();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (balance: StockBalance) => {
    const key = balanceKey(balance);
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    setMovements([]);
    setIsHistoryLoading(true);
    setHistoryError('');
    try {
      // 그 (물품 × 판매자) 조합의 이력. 기간은 서버 기본값(최근 30일)을 쓴다.
      setMovements(
        await stockUseCase.getHistory({
          productId: balance.productId,
          sellerId: balance.sellerId,
        })
      );
    } catch {
      setHistoryError('재고 이력 조회에 실패했습니다.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <PageContainer title="재고 조회">
      <StockSearchForm
        keyword={keyword}
        sellerId={sellerId}
        sellers={sellers}
        isLoading={isLoading}
        onKeywordChange={setKeyword}
        onSellerChange={setSellerId}
        onSearch={() => loadBalances()}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      <StockSearchTable
        balances={balances}
        isLoading={isLoading}
        expandedKey={expandedKey}
        movements={movements}
        isHistoryLoading={isHistoryLoading}
        historyError={historyError}
        onToggle={handleToggle}
      />
    </PageContainer>
  );
}
