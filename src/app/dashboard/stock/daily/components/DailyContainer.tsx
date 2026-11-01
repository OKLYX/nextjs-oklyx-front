'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import { STOCK_MOVEMENT_TYPE_LABELS, STOCK_REASON_LABELS } from '@/domain/entities/StockEntity';
import {
  UNDECIDED_SELLER_LABEL,
  formatWonOrUnknown,
  type StockDaily,
  type StockDailyRow,
} from '@/domain/entities/StockLotEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ReceiptAssignModal } from './ReceiptAssignModal';

/**
 * 「재고관리 > 그날 입출고 내역」 (FEATURE_2610_19 D119 · D122 · D123 · D124 · D128 · D130 · D147).
 *
 * - One day (today first): every ledger row moved that day, record order, quantity + purchase-price amount
 *   (null = 「미기입」). No selling price, no totals (D122 · D123 ③).
 * - Undecided intake rows show their owners 「○○ 4」 and 「영수증 미등록 N개 남음」 (D130 · D121 ⑤); outbound rows show
 *   the order seller and 「{seller} 재고 사용」 · 「영수증 미등록 재고 사용」 (D124 · D128).
 * - The top line 「영수증 미등록 N건」 (D147) with [영수증 올리기] opens the assignment popup for that day (D118 · D121).
 */

// Local calendar day (YYYY-MM-DD) — toISOString (UTC) can be a day off in KST.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

function kindLabel(row: StockDailyRow): string {
  const type = STOCK_MOVEMENT_TYPE_LABELS[row.movementType] ?? row.movementType;
  const reason = row.reason ? STOCK_REASON_LABELS[row.reason] ?? row.reason : '';
  return reason ? `${type} · ${reason}` : type;
}

function sellerCell(row: StockDailyRow): string {
  if (row.undecidedLeft !== null) {
    const parts = [...row.owners];
    if (row.undecidedLeft > 0) parts.push(`영수증 미등록 ${row.undecidedLeft}개 남음`);
    return parts.join(' · ');
  }
  return row.sellerName ?? UNDECIDED_SELLER_LABEL;
}

export function DailyContainer() {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [date, setDate] = useState(today());
  const [daily, setDaily] = useState<StockDaily | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const load = useCallback(
    async (day: string) => {
      setIsLoading(true);
      setError('');
      try {
        setDaily(await lotUseCase.daily(day));
      } catch (err) {
        setError(extractErrorMessage(err, '그날 입출고 내역을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    },
    [lotUseCase]
  );

  // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    void (async () => {
      await load(date);
    })();
  }, [load, date]);

  useEffect(() => {
    void sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => setSellers([]));
  }, [sellerUseCase]);

  const rows = daily?.rows ?? [];

  return (
    <PageContainer title="그날 입출고 내역">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {daily && daily.unregisteredProductCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-amber-800">영수증 미등록 {daily.unregisteredProductCount}건</span>
            <Button size="sm" onClick={() => setIsAssignOpen(true)}>
              영수증 올리기
            </Button>
          </div>
        )}
      </div>

      <TableCard isLoading={isLoading} error={error} isEmpty={rows.length === 0} emptyMessage="그날 입출고가 없습니다.">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2">구분</th>
              <th className="px-4 py-2">상품</th>
              <th className="px-4 py-2 text-right">개수</th>
              <th className="px-4 py-2">판매자</th>
              <th className="px-4 py-2">주문번호</th>
              <th className="px-4 py-2">표시</th>
              <th className="px-4 py-2 text-right">매입가 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.movementId}>
                <td className="px-4 py-2 text-gray-700">{kindLabel(row)}</td>
                <td className="px-4 py-2 text-gray-900">{row.productName}</td>
                <td className="px-4 py-2 text-right text-gray-900">{row.quantity}</td>
                <td className="px-4 py-2 text-gray-700">{sellerCell(row)}</td>
                <td className="px-4 py-2 text-gray-700">{row.orderNumber ?? '-'}</td>
                <td className="px-4 py-2 text-amber-800">{row.tags.join(' · ')}</td>
                <td className="px-4 py-2 text-right text-gray-900">{formatWonOrUnknown(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <ReceiptAssignModal
        isOpen={isAssignOpen}
        date={date}
        products={daily?.unregistered ?? []}
        sellers={sellers}
        onClose={() => setIsAssignOpen(false)}
        onSaved={async () => {
          setIsAssignOpen(false);
          await load(date);
        }}
      />
    </PageContainer>
  );
}
