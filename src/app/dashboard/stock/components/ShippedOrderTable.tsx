'use client';

import type { ShippedOrder } from '@/domain/entities/StockWorkEntity';
import { salesChannelLabel } from '@/domain/entities/OrderEntity';
import { NameText } from '@/presentation/components/NameText';

/**
 * 「최근 14일 출고 주문」 — the order list of [송장 없이 반품 완료] (FEATURE_2611_34 D24 · D25 · D29 · D39 · D43).
 *
 * **Purpose**: pick the order whose box came back before the carrier took it; orders with a claim not fully back
 * carry the 「반품·교환 접수」 tag.
 * **File**: `src/app/dashboard/stock/components/ShippedOrderTable.tsx`
 * **Used by**: `ClaimWorkPanel` — 「입고 작업」 「반품 재입고」.
 *
 * **Example**:
 * ```tsx
 * <ShippedOrderTable orders={orders} isLoading={isListLoading} onPick={pickOrder} />
 * ```
 *
 * ⚠️ Props only — it calls no server. Rows keep the server order (tagged first, then newest order day).
 * ❌ Do not sort or filter here — the order and the tag are the server's (D29).
 */
export interface ShippedOrderTableProps {
  orders: ShippedOrder[];
  isLoading: boolean;
  onPick: (order: ShippedOrder) => void;
}

const TH_CLASS = 'px-4 py-2 text-left text-sm font-semibold text-gray-900';
const TD_CLASS = 'px-4 py-2 text-sm text-gray-700';

export function ShippedOrderTable({ orders, isLoading, onPick }: ShippedOrderTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">최근 14일 출고 주문</h2>
      {isLoading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500">최근 14일 동안 출고된 주문이 없습니다.</p>
      ) : (
        <div className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className={TH_CLASS}>주문일</th>
                <th className={TH_CLASS}>주문번호</th>
                <th className={TH_CLASS}>판매처</th>
                <th className={TH_CLASS}>판매자</th>
                <th className={TH_CLASS}>상품</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50">
                  <td className={TD_CLASS}>{order.orderedAt?.slice(0, 10) ?? '-'}</td>
                  <td className={TD_CLASS}>{order.externalOrderId}</td>
                  <td className={TD_CLASS}>{salesChannelLabel(order.platform, order.accountAlias)}</td>
                  <td className={TD_CLASS}>{order.sellerName ?? '-'}</td>
                  <td className={TD_CLASS}>
                    <span className="flex items-start gap-2">
                      <NameText kind="product" name={order.itemName} inTable expandable />
                      {order.claimPending && <span className="shrink-0 text-xs text-amber-700">반품·교환 접수</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onPick(order)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                    >
                      고르기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
