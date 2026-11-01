'use client';

import type { StockMovement } from '@/domain/entities/StockEntity';
import { UNDECIDED_SELLER_LABEL } from '@/domain/entities/StockLotEntity';
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_REASON_LABELS,
} from '@/domain/entities/StockEntity';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { StockProductThumb } from './StockProductThumb';

/**
 * Stock ledger history table (FEATURE_2609_28).
 *
 * **Purpose**: the table <b>shared by</b> the recent history of 「입고·조정」 and the row expansion of 「재고 조회」.
 * **Rule**: a screen that draws history uses this component — do not copy the sign colour or label rules.
 * **File**: src/app/dashboard/stock/components/StockMovementTable.tsx
 *
 * **Usage**:
 * <StockMovementTable movements={movements} isLoading={isLoading} error={error} />
 * <StockMovementTable movements={movements} isLoading={false} error="" showSeller={false} />
 *
 * ⚠️ quantity is drawn with the sign the server stored — the screen never builds a sign (PLAN 2609_28 D6).
 * ⚠️ The handler (createdBy) is required ledger information. Without a value it shows '—', the column stays (D9).
 * ⚠️ The 「상품」 cell and the card show the product photo left of the name (`StockProductThumb`, FEATURE_2611_02 D13 ·
 *    D14 · D20) — in both places that use this table, with no switch.
 */
interface StockMovementTableProps {
  movements: StockMovement[];
  isLoading: boolean;
  error: string;
  /** 이미 판매자로 좁혀진 문맥(잔량 행 펼침 등)에서는 열을 숨긴다. */
  showSeller?: boolean;
  emptyMessage?: string;
  /** Where the narrow-screen cards sit (FEATURE_2610_31 D25): `page` (default) or `nested` (inside a table row). */
  cardPlacement?: 'page' | 'nested';
}

export function StockMovementTable({
  movements,
  isLoading,
  error,
  showSeller = true,
  emptyMessage = '이력이 없습니다.',
  cardPlacement = 'page',
}: StockMovementTableProps) {
  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  // Narrow-screen cards (FEATURE_2610_31 D14 · D37): the app's movement line — 「MM-DD」, the product name, then
  // 「유형 · 사유 · 판매자 · 처리자」 (「사유」 「기타」 with a note reads 「기타 · 메모」; the seller shows even where the
  // table hides its column — the app line always has it) and the signed quantity on the right; the table's 「메모」
  // at the bottom when the reason is not 「기타」.
  const renderCards = () =>
    movements.map((movement) => {
      const note = movement.reasonNote?.trim() ?? '';
      const reasonText =
        movement.reason === 'ETC' && note
          ? `기타 · ${note}`
          : movement.reason
            ? (STOCK_REASON_LABELS[movement.reason] ?? movement.reason)
            : '';
      const detail = [
        STOCK_MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType,
        reasonText,
        movement.sellerName ?? UNDECIDED_SELLER_LABEL,
        movement.createdBy ?? '',
      ]
        .filter((part) => part)
        .join(' · ');
      return (
        <DataCard
          key={movement.id}
          body={
            <div className="flex items-start gap-2">
              <span className="w-[46px] shrink-0 text-xs text-gray-500">
                {movement.movedOn.length >= 10 ? movement.movedOn.slice(5, 10) : movement.movedOn}
              </span>
              <StockProductThumb
                imageUrl={movement.imageUrl}
                productId={movement.productId}
                alt={movement.productName}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-gray-900">{movement.productName}</p>
                <p className="line-clamp-2 text-[11px] text-gray-500">{detail}</p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${movement.quantity >= 0 ? 'text-blue-700' : 'text-red-600'}`}
              >
                {movement.quantity >= 0 ? `+${movement.quantity}` : `−${Math.abs(movement.quantity)}`}
              </span>
            </div>
          }
          extraFields={[{ label: '메모', value: movement.reason === 'ETC' ? '' : (movement.reasonNote ?? '') }]}
        />
      );
    });

  return (
    <DataCardSwitch placement={cardPlacement} renderCards={renderCards} className="list-table-scroll">
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">날짜</th>
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">상품</th>
            {showSeller && (
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">판매자</th>
            )}
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">유형</th>
            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">수량</th>
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">사유</th>
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">처리자</th>
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">메모</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {movements.map((movement) => (
            <tr key={movement.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-700">{movement.movedOn}</td>
              <td className="px-4 py-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <StockProductThumb
                    imageUrl={movement.imageUrl}
                    productId={movement.productId}
                    alt={movement.productName}
                  />
                  <span>{movement.productName}</span>
                </div>
              </td>
              {showSeller && (
                <td className="px-4 py-2 text-sm text-gray-700">{movement.sellerName ?? UNDECIDED_SELLER_LABEL}</td>
              )}
              <td className="px-4 py-2 text-sm text-gray-700">
                {STOCK_MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType}
              </td>
              <td
                className={`px-4 py-2 text-sm text-right font-semibold ${
                  movement.quantity < 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
              </td>
              <td className="px-4 py-2 text-sm text-gray-700">
                {movement.reason ? (STOCK_REASON_LABELS[movement.reason] ?? movement.reason) : '—'}
              </td>
              <td className="px-4 py-2 text-sm text-gray-700">{movement.createdBy ?? '—'}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{movement.reasonNote ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataCardSwitch>
  );
}
