'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { StockBalance, StockMovement } from '@/domain/entities/StockEntity';
import { inAmountLine, stockAmountLines } from '@/domain/entities/StockLotEntity';
import { StockSearchForm } from './StockSearchForm';
import { StockSearchTable, balanceKey } from './StockSearchTable';
import { StockAmountSummary } from './StockAmountSummary';

/**
 * 「재고 조회」 screen (FEATURE_2609_28 / PLAN D14 · 2609_29 D5).
 *
 * On-hand is the server's aggregate per (product × seller). A row click opens that pair's history right below it.
 * FEATURE_2611_02: every row carries its photo and purchase-price amount; the amount box above the list adds the rows
 * received (D26 · D34) and its 「미기입 N줄」 narrows the list to the rows without an amount (D35 · D37).
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
  /** Key of the lit 「미기입 N줄」 (FEATURE_2611_02 D35 · D37); null = the whole list. */
  const [amountFilter, setAmountFilter] = useState<string | null>(null);

  // D35 · D37: a lit 「미기입 N줄」 shows only that line's rows without an amount.
  const filterRows = (key: string | null) =>
    key === null
      ? balances
      : balances.filter((balance) => balance.amount === null && inAmountLine(balance, key));

  const loadBalances = async (nextKeyword: string = keyword, nextSellerId: string = sellerId) => {
    setIsLoading(true);
    setError('');
    setExpandedKey(null);
    setAmountFilter(null);
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

  // D37 · D39: one 「미기입 N줄」 at a time — a click on the lit one turns it off. A row the filter hides is collapsed.
  const handleAmountFilter = (key: string) => {
    const next = amountFilter === key ? null : key;
    setAmountFilter(next);
    if (
      expandedKey !== null &&
      !filterRows(next).some((balance) => balanceKey(balance) === expandedKey)
    ) {
      setExpandedKey(null);
    }
  };

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
      // The history of that (product × seller) pair, over the server's default period (the last 30 days).
      // FEATURE_2610_19: the 「판매자 미정」 row (seller null) shows the product's rows of every seller.
      setMovements(
        await stockUseCase.getHistory({
          productId: balance.productId,
          sellerId: balance.sellerId ?? undefined,
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

      {balances.length > 0 && (
        <StockAmountSummary
          lines={stockAmountLines(balances)}
          activeKey={amountFilter}
          onToggle={handleAmountFilter}
        />
      )}

      <StockSearchTable
        balances={filterRows(amountFilter)}
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
