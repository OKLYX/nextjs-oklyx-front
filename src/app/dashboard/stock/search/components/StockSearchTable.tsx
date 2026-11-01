'use client';

import { Fragment } from 'react';
import type { StockBalance, StockMovement } from '@/domain/entities/StockEntity';
import { UNDECIDED_SELLER_LABEL, formatWonOrUnknown } from '@/domain/entities/StockLotEntity';
import { StockMovementTable } from '../../components/StockMovementTable';
import { StockProductThumb } from '@/app/dashboard/stock/components/StockProductThumb';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

interface StockSearchTableProps {
  balances: StockBalance[];
  isLoading: boolean;
  /** 펼친 행 키(`productId:sellerId`). */
  expandedKey: string | null;
  movements: StockMovement[];
  isHistoryLoading: boolean;
  historyError: string;
  onToggle: (balance: StockBalance) => void;
}

export const balanceKey = (balance: StockBalance) => `${balance.productId}:${balance.sellerId}`;

/**
 * On-hand table per (product × seller) (FEATURE_2609_28 / PLAN D14 · 2609_29 D5).
 *
 * 🔴 Never hide a negative number or draw it as 0 — the ledger is the fact and a negative means "an intake is missing".
 * ⚠️ On-hand is the server's aggregate as received. The screen never adds it up again.
 * ⚠️ The amount box above (FEATURE_2611_02 D34) adds the rows' `amount` as received — that is a sum of the server's
 *    amounts, not a recount of on-hand.
 */
export function StockSearchTable({
  balances,
  isLoading,
  expandedKey,
  movements,
  isHistoryLoading,
  historyError,
  onToggle,
}: StockSearchTableProps) {
  // Narrow-screen cards (FEATURE_2610_31 D14 · D33): the app's balance line — 「▸ product」, the seller, the on-hand
  // count on the right (red with a note when negative). A tap opens the movements right under the card, above the
  // next card.
  const renderCards = () =>
    balances.map((balance) => {
      const key = balanceKey(balance);
      const isExpanded = expandedKey === key;
      const negative = balance.onHand < 0;
      return (
        <Fragment key={key}>
          <DataCard
            onClick={() => onToggle(balance)}
            body={
              <div className="flex items-center gap-2">
                <StockProductThumb
                  imageUrl={balance.imageUrl}
                  productId={balance.productId}
                  alt={balance.productName}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-gray-900">
                    {isExpanded ? '▾' : '▸'} {balance.productName}
                  </p>
                  <p className="text-[11px] text-gray-500">{balance.sellerName ?? UNDECIDED_SELLER_LABEL}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[15px] font-bold ${negative ? 'text-red-600' : 'text-gray-900'}`}>
                    {balance.onHand}
                  </p>
                  <p className="text-[11px] text-gray-500">{formatWonOrUnknown(balance.amount)}</p>
                  {negative && <p className="text-[10px] text-red-600">입고 기록이 빠졌을 수 있습니다</p>}
                </div>
              </div>
            }
          />
          {isExpanded && (
            <div className="bg-gray-50 px-4 py-3">
              <StockMovementTable
                movements={movements}
                isLoading={isHistoryLoading}
                error={historyError}
                showSeller={false}
                emptyMessage="이 기간(최근 30일)에 기록된 이동이 없습니다."
                cardPlacement="nested"
              />
            </div>
          )}
        </Fragment>
      );
    });

  return (
    <TableCard
      isLoading={isLoading}
      isEmpty={balances.length === 0}
      emptyMessage="조회 결과가 없습니다."
      renderCards={renderCards}
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">잔량</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">매입가 금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {balances.map((balance) => {
            const key = balanceKey(balance);
            const isExpanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <tr onClick={() => onToggle(balance)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <StockProductThumb
                        imageUrl={balance.imageUrl}
                        productId={balance.productId}
                        alt={balance.productName}
                      />
                      <span>
                        {isExpanded ? '▾' : '▸'} {balance.productName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{balance.sellerName ?? UNDECIDED_SELLER_LABEL}</td>
                  <td
                    className={`px-6 py-3 text-sm text-right font-semibold ${
                      balance.onHand < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                    title={balance.onHand < 0 ? '입고 기록이 빠졌을 수 있습니다' : undefined}
                  >
                    {balance.onHand}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">{formatWonOrUnknown(balance.amount)}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-6 py-3">
                      <StockMovementTable
                        movements={movements}
                        isLoading={isHistoryLoading}
                        error={historyError}
                        showSeller={false}
                        emptyMessage="이 기간(최근 30일)에 기록된 이동이 없습니다."
                        cardPlacement="nested"
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
