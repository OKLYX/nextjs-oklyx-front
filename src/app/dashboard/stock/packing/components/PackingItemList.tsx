'use client';

import { Check } from 'lucide-react';

/**
 * 이 박스에 담을 것 — 담은 수량 / 필요 수량 / 남음 (FEATURE_2609_40 / PLAN D10 · D33).
 *
 * 🔴 상태를 갖지 않는다. 값은 페이지가 소유하고 여기는 그리기만 한다.
 * 🔴 `lastTouchedProductId` 강조가 기능이다 — 「숫자 + Enter = 수량 수정」이 **직전에 담은 물품
 * 하나**에만 적용되므로(D33), 무엇이 바뀌는지 화면에 보여야 한다.
 */
export interface PackedRow {
  orderLineId: number;
  productId: number;
  productName: string;
  itemName: string;
  barcodeId: string | null;
  /** 지금까지 담은 수량 */
  packedQty: number;
  /** 이 박스에 담을 수 있는 수량(= 서버가 준 잔량) */
  remainingQty: number;
}

export interface PackingItemListProps {
  items: PackedRow[];
  lastTouchedProductId: number | null;
  onQuantityChange: (productId: number, qty: number) => void;
}

export function PackingItemList({
  items,
  lastTouchedProductId,
  onQuantityChange,
}: PackingItemListProps) {
  if (items.length === 0) {
    return <div className="p-8 text-center text-gray-500">담을 물품이 없습니다</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr>
          <th className="px-4 py-2 text-left font-medium text-gray-700">담을 것</th>
          <th className="px-4 py-2 text-left font-medium text-gray-700">주문 상품</th>
          <th className="px-4 py-2 text-center font-medium text-gray-700 w-40">담음 / 필요</th>
          <th className="px-4 py-2 text-center font-medium text-gray-700 w-20">남음</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const done = item.packedQty >= item.remainingQty;
          const highlighted = item.productId === lastTouchedProductId;
          return (
            <tr
              key={`${item.orderLineId}:${item.productId}`}
              className={`border-b border-gray-100 ${highlighted ? 'bg-amber-50' : ''}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {done ? (
                    <Check size={16} className="text-green-600" aria-label="다 담음" />
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className={`font-medium ${done ? 'text-gray-500' : 'text-gray-900'}`}>
                    {item.productName}
                  </span>
                  {item.barcodeId && (
                    <span className="font-mono text-xs text-gray-400">{item.barcodeId}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{item.itemName}</td>
              <td className="px-4 py-3 text-center">
                <input
                  type="number"
                  min={0}
                  max={item.remainingQty}
                  value={item.packedQty}
                  onChange={(event) =>
                    onQuantityChange(item.productId, Number(event.target.value))
                  }
                  className="h-8 w-16 rounded border border-gray-300 text-center"
                  aria-label={`${item.productName} 담은 수량`}
                />
                <span className="ml-2 text-gray-500">/ {item.remainingQty}</span>
              </td>
              <td
                className={`px-4 py-3 text-center text-lg font-semibold ${
                  done ? 'text-gray-400' : 'text-red-600'
                }`}
              >
                {item.remainingQty - item.packedQty}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
