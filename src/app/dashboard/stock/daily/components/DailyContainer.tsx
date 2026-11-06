'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
  rowPriceTarget,
  sharePriceTarget,
  shareLineText,
  type StockDaily,
  type StockDailyRow,
} from '@/domain/entities/StockLotEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ReceiptAssignModal } from './ReceiptAssignModal';
import { SellerChangeModal } from './SellerChangeModal';
import { PurchasePriceModal } from './PurchasePriceModal';
import { StockProductThumb } from '@/app/dashboard/stock/components/StockProductThumb';

/**
 * 「재고관리 > 일별 입출고 내역」 (FEATURE_2610_19 D119 · D122 · D123 · D124 · D128 · D130 · D147).
 *
 * - One day (today first): every ledger row moved that day, record order, quantity + purchase-price amount
 *   (null = 「미기입」). No selling price, no totals (D122 · D123 ③).
 * - Undecided intake rows show their owners 「○○ 4」 and 「영수증 미등록 N개 남음」 (D130 · D121 ⑤); outbound rows show
 *   the order seller and 「{seller} 재고 사용」 · 「영수증 미등록 재고 사용」 (D124 · D128).
 * - The top line 「영수증 미등록 N건」 (D147) with [영수증 올리기] opens the assignment popup for that day (D118 · D121);
 *   [영수증 없이 판매자 정하기] next to it opens the same popup without a photo (FEATURE_2611_01 D2 · D4).
 * - One check column for four buttons (FEATURE_2611_01 D14): an undecided row with a quantity left, a decided incoming
 *   row without a receipt, a row with a purchase record and every share (a line under its undecided row) can be
 *   checked. Only undecided rows checked → the two receipt buttons open with those products at their remaining
 *   quantity · [판매자 바꾸기] (D7 · D15) is on when every checked row and share is seller-changeable · nothing
 *   checked → the receipt buttons open with every product of the day at 0, [판매자 바꾸기] is off.
 * - [매입가 넣기] (FEATURE_2611_16 D7 · D8) is on when every checked row and share is a purchase-price target; it opens
 *   the popup with those targets in table order. Each share line reads 「└ {seller} {N}개 · {kind} · {amount}」.
 */

type AssignMode = 'RECEIPT' | 'WITHOUT_RECEIPT';

const rowKey = (row: StockDailyRow) => `row-${row.movementId}`;
const shareKey = (recordId: number) => `share-${recordId}`;

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
  const [assignMode, setAssignMode] = useState<AssignMode | null>(null);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (day: string) => {
      setIsLoading(true);
      setError('');
      setChecked(new Set());
      try {
        setDaily(await lotUseCase.daily(day));
      } catch (err) {
        setError(extractErrorMessage(err, '일별 입출고 내역을 불러오지 못했습니다.'));
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

  // D14: the popup gets the checked products only (every product when nothing is checked). Memoized — the popup
  // resets its fields whenever this array changes.
  const assignProducts = useMemo(() => {
    const all = daily?.unregistered ?? [];
    if (checked.size === 0) return all;
    const picked = (daily?.rows ?? []).filter((row) => checked.has(rowKey(row)) && (row.undecidedLeft ?? 0) > 0);
    return all.filter((p) => picked.some((row) => row.productId === p.productId));
  }, [daily, checked]);

  // FEATURE_2611_16 D7: the checked targets in table order (each row, then its checked shares). Memoized for the same
  // reason as assignProducts.
  const priceTargets = useMemo(
    () =>
      (daily?.rows ?? []).flatMap((row) => {
        const rowTarget = checked.has(rowKey(row)) ? rowPriceTarget(row) : null;
        const shareTargets = row.shares
          .filter((share) => checked.has(shareKey(share.recordId)))
          .map((share) => sharePriceTarget(row, share));
        return rowTarget ? [rowTarget, ...shareTargets] : shareTargets;
      }),
    [daily, checked]
  );

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Header [전체 선택]: every checkable row and share on the day; a second click clears them.
  const checkableKeys = rows.flatMap((row) => [
    ...((row.undecidedLeft ?? 0) > 0 || row.sellerChangeable || row.recordId !== null ? [rowKey(row)] : []),
    ...row.shares.map((share) => shareKey(share.recordId)),
  ]);
  const allChecked = checkableKeys.length > 0 && checkableKeys.every((key) => checked.has(key));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(checkableKeys));

  // D14: the checked rows and shares, split by kind.
  const checkedRows = rows.filter((row) => checked.has(rowKey(row)));
  const checkedShares = rows.flatMap((row) =>
    row.shares.filter((share) => checked.has(shareKey(share.recordId))).map((share) => ({ row, share }))
  );
  const changeSharesChecked = checkedShares.filter(({ share }) => share.sellerChangeable);
  const checkedCount = checkedRows.length + checkedShares.length;
  const undecidedChecked = checkedRows.filter((row) => (row.undecidedLeft ?? 0) > 0);
  const changeRowsChecked = checkedRows.filter((row) => row.sellerChangeable);
  const canAssign = checkedCount === 0 || undecidedChecked.length === checkedCount;
  const canChange = checkedCount > 0 && changeRowsChecked.length + changeSharesChecked.length === checkedCount;
  const canPrice = checkedCount > 0 && checkedRows.every((row) => rowPriceTarget(row) !== null);
  const changeLabels = [
    ...changeRowsChecked.map(
      (row) => `${row.productName} ${row.quantity}개 · ${row.sellerName ?? UNDECIDED_SELLER_LABEL}`
    ),
    ...changeSharesChecked.map(({ row, share }) => `${row.productName} ${share.quantity}개 · ${share.sellerName} (영수증 없음)`),
  ];

  const afterSave = async () => {
    setAssignMode(null);
    setIsChangeOpen(false);
    setIsPriceOpen(false);
    await load(date);
  };

  return (
    <PageContainer title="일별 입출고 내역">
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
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {daily && daily.unregisteredProductCount > 0 && (
            <>
              <span className="text-sm font-medium text-amber-800">
                영수증 미등록 {daily.unregisteredProductCount}건
              </span>
              <Button size="sm" disabled={!canAssign} onClick={() => setAssignMode('RECEIPT')}>
                영수증 올리기
              </Button>
              <Button size="sm" variant="secondary" disabled={!canAssign} onClick={() => setAssignMode('WITHOUT_RECEIPT')}>
                영수증 없이 판매자 정하기
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" disabled={!canChange} onClick={() => setIsChangeOpen(true)}>
            판매자 바꾸기
          </Button>
          <Button size="sm" variant="secondary" disabled={!canPrice} onClick={() => setIsPriceOpen(true)}>
            매입가 넣기
          </Button>
        </div>
      </div>

      <TableCard isLoading={isLoading} error={error} isEmpty={rows.length === 0} emptyMessage="그날 입출고가 없습니다.">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 w-10">
                {checkableKeys.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 accent-blue-600"
                  />
                )}
              </th>
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
              <Fragment key={row.movementId}>
                <tr>
                  <td className="px-4 py-2">
                    {((row.undecidedLeft ?? 0) > 0 || row.sellerChangeable || row.recordId !== null) && (
                      <input
                        type="checkbox"
                        checked={checked.has(rowKey(row))}
                        onChange={() => toggle(rowKey(row))}
                        className="h-4 w-4 accent-blue-600"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{kindLabel(row)}</td>
                  <td className="px-4 py-2 text-gray-900">
                    <div className="flex items-center gap-2">
                      <StockProductThumb imageUrl={row.imageUrl} productId={row.productId} alt={row.productName} />
                      <span>{row.productName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{row.quantity}</td>
                  <td className="px-4 py-2 text-gray-700">{sellerCell(row)}</td>
                  <td className="px-4 py-2 text-gray-700">{row.orderNumber ?? '-'}</td>
                  <td className="px-4 py-2 text-amber-800">{row.tags.join(' · ')}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatWonOrUnknown(row.amount)}</td>
                </tr>
                {row.shares.map((share) => (
                  <tr key={shareKey(share.recordId)} className="bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(shareKey(share.recordId))}
                        onChange={() => toggle(shareKey(share.recordId))}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </td>
                    <td colSpan={7} className="px-4 py-2 text-gray-700">
                      {shareLineText(share)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableCard>

      <ReceiptAssignModal
        isOpen={assignMode !== null}
        mode={assignMode ?? 'RECEIPT'}
        prefillRemaining={checkedCount > 0}
        date={date}
        products={assignProducts}
        sellers={sellers}
        onClose={() => setAssignMode(null)}
        onSaved={afterSave}
      />

      <SellerChangeModal
        isOpen={isChangeOpen}
        movementIds={changeRowsChecked.map((row) => row.movementId)}
        shareRecordIds={changeSharesChecked.map(({ share }) => share.recordId)}
        labels={changeLabels}
        sellers={sellers}
        onClose={() => setIsChangeOpen(false)}
        onSaved={afterSave}
      />

      <PurchasePriceModal
        isOpen={isPriceOpen}
        date={date}
        targets={priceTargets}
        onClose={() => setIsPriceOpen(false)}
        onSaved={afterSave}
      />
    </PageContainer>
  );
}
