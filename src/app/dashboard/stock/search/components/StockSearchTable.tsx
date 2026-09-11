'use client';

import { Fragment } from 'react';
import type { StockBalance, StockMovement } from '@/domain/entities/StockEntity';
import { StockMovementTable } from '../../components/StockMovementTable';
import { TableCard } from '@/presentation/components/ui/TableCard';

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
 * (물품 × 판매자) 잔량 표 (FEATURE_2609_28 / PLAN D14 · 2609_29 D5).
 *
 * 🔴 음수를 숨기거나 0 으로 그리지 않는다 — 원장이 사실이고 음수는 "입고 기록이 빠졌다"는 신호다.
 * ⚠️ 잔량은 서버 집계 결과 그대로다. 화면에서 다시 더하지 않는다.
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
  return (
    <TableCard
      isLoading={isLoading}
      isEmpty={balances.length === 0}
      emptyMessage="조회 결과가 없습니다."
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">잔량</th>
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
                    {isExpanded ? '▾' : '▸'} {balance.productName}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{balance.sellerName}</td>
                  <td
                    className={`px-6 py-3 text-sm text-right font-semibold ${
                      balance.onHand < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                    title={balance.onHand < 0 ? '입고 기록이 빠졌을 수 있습니다' : undefined}
                  >
                    {balance.onHand}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-6 py-3">
                      <StockMovementTable
                        movements={movements}
                        isLoading={isHistoryLoading}
                        error={historyError}
                        showSeller={false}
                        emptyMessage="이 기간(최근 30일)에 기록된 이동이 없습니다."
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
