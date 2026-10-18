'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PurchaseReceiptRepositoryImpl } from '@/infrastructure/repositories/PurchaseReceiptRepositoryImpl';
import { PurchaseReceiptUseCase } from '@/application/usecases/PurchaseReceiptUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { parseQuery, toApiParams, toSearchParams, type ReceiptListQuery } from '../receiptListQuery';
import { ReceiptDetailModal } from './ReceiptDetailModal';

/**
 * 「구매관리 > 영수증」 — receipts newest day first (FEATURE_2610_18 D93 ② · D94).
 *
 * **File**: src/app/dashboard/purchase/receipts/components/ReceiptList.tsx
 * - Row = date · payer seller · card alias (「카드 없음」 when unknown) · 「first product 외 N개」 · amount sum
 *   (「미기입」 when every line is blank). A row click opens `ReceiptDetailModal`; a header edit there reloads the list.
 * - Filters = period (default latest 30 days) · payer seller (「전체」 + sellers) · product name.
 * - One seller → the payer seller filter and the seller/card columns are hidden (D37 · D53).
 *
 * ⚠️ The conditions live in the URL (`receiptListQuery.ts`) — period and seller apply at once, the product name on
 * [검색] / Enter. `updateQuery` is the only updater.
 */
const formatAmount = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const productSummary = (row: ReceiptSummary) => {
  if (!row.firstProductName) return '-';
  return row.productCount > 1 ? `${row.firstProductName} 외 ${row.productCount - 1}개` : row.firstProductName;
};

const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500';

export function ReceiptList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiptUseCase = useMemo(() => new PurchaseReceiptUseCase(new PurchaseReceiptRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  // Memo on the URL string — the useSearchParams object identity changes on every parent render.
  const searchKey = searchParams.toString();
  const query = useMemo(() => parseQuery(new URLSearchParams(searchKey)), [searchKey]);
  const { from, to, sellerId, q } = query;

  // The typed product name is local; the committed one is the URL (`q`) — read once on mount.
  const [searchTerm, setSearchTerm] = useState(q ?? '');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [rows, setRows] = useState<ReceiptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);

  const soleSeller = sellers.length === 1;

  /** The single updater. The same URL → reloadTick, so [검색] always loads again. */
  const updateQuery = useCallback(
    (patch: Partial<ReceiptListQuery>) => {
      const next: ReceiptListQuery = { ...query, ...patch };
      const qs = toSearchParams(next).toString();
      if (qs === toSearchParams(query).toString()) {
        setReloadTick((tick) => tick + 1);
        return;
      }
      router.replace(`?${qs}`, { scroll: false });
    },
    [query, router],
  );

  const handleSearch = useCallback(() => {
    const next = searchTerm.trim();
    updateQuery({ q: next ? next : undefined });
  }, [searchTerm, updateQuery]);

  useEffect(() => {
    void (async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        setSellers([]);
      }
    })();
  }, [sellerUseCase]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setIsLoading(true);
      setError('');
      try {
        const result = await receiptUseCase.search(toApiParams({ from, to, sellerId, q }));
        if (alive) setRows(result);
      } catch {
        if (alive) setError('영수증 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [receiptUseCase, from, to, sellerId, q, reloadTick]);

  return (
    <PageContainer title="영수증">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">기간</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={from}
                onChange={(e) => updateQuery({ from: e.target.value })}
                className={INPUT_CLASS}
              />
              <span className="text-sm text-gray-500">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => updateQuery({ to: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          {!soleSeller && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">결제 판매자</label>
              <select
                value={sellerId ?? ''}
                onChange={(e) => updateQuery({ sellerId: e.target.value ? Number(e.target.value) : undefined })}
                className={INPUT_CLASS}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-end gap-2"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">상품 이름</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              검색
            </Button>
          </form>
        </div>
      </Card>

      <TableCard
        isLoading={isLoading}
        error={error}
        isEmpty={rows.length === 0}
        emptyMessage="영수증이 없습니다."
      >
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">날짜</th>
              {!soleSeller && (
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">결제 판매자</th>
              )}
              {!soleSeller && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">카드</th>}
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">상품</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">금액 합</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => setOpenReceiptId(row.id)}
                className="hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-700">{row.purchasedOn}</td>
                {!soleSeller && <td className="px-4 py-3 text-sm text-gray-700">{row.payerSellerName}</td>}
                {!soleSeller && <td className="px-4 py-3 text-sm text-gray-700">{row.cardAlias ?? '카드 없음'}</td>}
                <td className="px-4 py-3 text-sm text-gray-700">{productSummary(row)}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {row.totalAmount == null ? (
                    <span className="text-gray-400">미기입</span>
                  ) : (
                    <span className="text-gray-900">{formatAmount(row.totalAmount)}원</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <ReceiptDetailModal
        receiptId={openReceiptId}
        sellers={sellers}
        onClose={() => setOpenReceiptId(null)}
        onEdited={() => setReloadTick((tick) => tick + 1)}
      />
    </PageContainer>
  );
}
