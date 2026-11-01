'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import {
  formatWonOrUnknown,
  type SellerDebtEntry,
  type SellerDebtPair,
} from '@/domain/entities/StockLotEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { SettlementModal } from './SettlementModal';
import { UnitPriceModal } from './UnitPriceModal';

/**
 * 「정산관리 > 사업자 간 채무」 (FEATURE_2610_19 D36 · D39 · D51 · D90 · D137 · D141 · D143).
 *
 * - One line per seller pair: 「A상사 → B상사 ₩M」 (who owes whom, borrowed goods both ways and settlements netted).
 *   「미기입 N건」 when a debt has no amount; such a pair stays listed even at ₩0 (D137).
 * - A click opens the cause list: 「출고 차용」 rows (order, product, quantity, amount or 「미기입」) and 「돈 정리」 rows
 *   (payer → receiver, memo, [취소]). A 「미기입」 row has [단가 입력], a price typed here has [단가 수정] (D141 · D143).
 * - [돈으로 정리] records a cash settlement of the open pair (D90).
 *
 * The screen does not look at the stock link setting (D148 ③ ④).
 */
export function SellerDebtContainer() {
  const useCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);

  const [pairs, setPairs] = useState<SellerDebtPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [entries, setEntries] = useState<SellerDebtEntry[]>([]);
  const [entriesError, setEntriesError] = useState('');
  const [settlePair, setSettlePair] = useState<SellerDebtPair | null>(null);
  const [priceEntry, setPriceEntry] = useState<SellerDebtEntry | null>(null);
  const [cancelEntry, setCancelEntry] = useState<SellerDebtEntry | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const keyOf = (pair: SellerDebtPair) => `${pair.sellerAId}:${pair.sellerBId}`;

  const loadPairs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setPairs(await useCase.debtPairs());
    } catch (err) {
      setError(extractErrorMessage(err, '사업자 간 채무를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [useCase]);

  const loadEntries = useCallback(
    async (pair: SellerDebtPair) => {
      setEntriesError('');
      try {
        setEntries(await useCase.debtEntries(pair.sellerAId, pair.sellerBId));
      } catch (err) {
        setEntriesError(extractErrorMessage(err, '원인 목록을 불러오지 못했습니다.'));
      }
    },
    [useCase]
  );

  // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    void (async () => {
      await loadPairs();
    })();
  }, [loadPairs]);

  const reloadOpen = async () => {
    await loadPairs();
    const pair = pairs.find((p) => keyOf(p) === openKey);
    if (pair) await loadEntries(pair);
  };

  const toggle = (pair: SellerDebtPair) => {
    const key = keyOf(pair);
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    setEntries([]);
    void loadEntries(pair);
  };

  const pairText = (pair: SellerDebtPair) => {
    if (pair.debtorId === null) return `${pair.sellerAName} · ${pair.sellerBName} 잔액 없음`;
    const aOwes = pair.debtorId === pair.sellerAId;
    const debtor = aOwes ? pair.sellerAName : pair.sellerBName;
    const creditor = aOwes ? pair.sellerBName : pair.sellerAName;
    return `${debtor} → ${creditor} ${formatWonOrUnknown(pair.balance)}`;
  };

  const confirmCancel = async () => {
    if (!cancelEntry) return;
    setIsCancelling(true);
    try {
      await useCase.cancelSettlement(cancelEntry.id);
      toast.success('돈 정리 기록을 취소했습니다.');
      setCancelEntry(null);
      await reloadOpen();
    } catch (err) {
      toast.error(extractErrorMessage(err, '취소하지 못했습니다.'));
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <PageContainer title="사업자 간 채무">
      <TableCard isLoading={isLoading} error={error} isEmpty={pairs.length === 0} emptyMessage="판매자 사이의 채무가 없습니다.">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <tbody className="divide-y divide-gray-200">
            {pairs.map((pair) => {
              const key = keyOf(pair);
              const isOpen = openKey === key;
              return (
                <Fragment key={key}>
                  <tr onClick={() => toggle(pair)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-gray-900">
                      {isOpen ? '▾' : '▸'} {pairText(pair)}
                      {pair.unknownCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                          미기입 {pair.unknownCount}건
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettlePair(pair);
                        }}
                      >
                        돈으로 정리
                      </Button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 bg-gray-50">
                        {entriesError ? (
                          <p className="text-sm text-red-600">{entriesError}</p>
                        ) : (
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-1 pr-3">날짜</th>
                                <th className="py-1 pr-3">종류</th>
                                <th className="py-1 pr-3">내용</th>
                                <th className="py-1 pr-3 text-right">금액</th>
                                <th className="py-1" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {entries.map((entry) => (
                                <tr key={`${entry.kind}:${entry.id}`} className={entry.cancelled ? 'text-gray-400' : ''}>
                                  <td className="py-1 pr-3">{entry.date}</td>
                                  <td className="py-1 pr-3">{entry.kind === 'BORROW' ? '출고 차용' : '돈 정리'}</td>
                                  <td className="py-1 pr-3">
                                    {entry.kind === 'BORROW'
                                      ? `${entry.fromSellerName} ← ${entry.toSellerName} · 주문 ${entry.orderNumber ?? '-'} · ${entry.productName} ${entry.quantity}개`
                                      : `${entry.fromSellerName} → ${entry.toSellerName}${entry.memo ? ` · ${entry.memo}` : ''}${entry.cancelled ? ' · 취소됨' : ''}`}
                                  </td>
                                  <td className="py-1 pr-3 text-right">{formatWonOrUnknown(entry.amount)}</td>
                                  <td className="py-1 text-right">
                                    {entry.kind === 'BORROW' && entry.canFillPrice && (
                                      <Button size="sm" onClick={() => setPriceEntry(entry)}>
                                        단가 입력
                                      </Button>
                                    )}
                                    {entry.kind === 'BORROW' && !entry.canFillPrice && entry.canEditPrice && (
                                      <Button size="sm" variant="secondary" onClick={() => setPriceEntry(entry)}>
                                        단가 수정
                                      </Button>
                                    )}
                                    {entry.kind === 'SETTLEMENT' && !entry.cancelled && (
                                      <Button size="sm" variant="secondary" onClick={() => setCancelEntry(entry)}>
                                        취소
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      <SettlementModal
        pair={settlePair}
        onClose={() => setSettlePair(null)}
        onSaved={async () => {
          setSettlePair(null);
          await reloadOpen();
        }}
      />
      <UnitPriceModal
        entry={priceEntry}
        onClose={() => setPriceEntry(null)}
        onSaved={async () => {
          setPriceEntry(null);
          await reloadOpen();
        }}
      />
      <ConfirmDialog
        isOpen={cancelEntry !== null}
        title="돈 정리 취소"
        message="이 돈 정리 기록을 취소합니다. 기록은 남고 잔액 계산에서 빠집니다."
        confirmText="취소하기"
        cancelText="닫기"
        isDangerous
        isLoading={isCancelling}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelEntry(null)}
      />
    </PageContainer>
  );
}
