'use client';

import type { UnmappedOrder } from '@/domain/entities/PurchaseListEntity';

interface UnmappedOrdersSectionProps {
  orders: UnmappedOrder[];
  isLoading: boolean;
}

export function UnmappedOrdersSection({ orders, isLoading }: UnmappedOrdersSectionProps) {
  if (isLoading || orders.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-amber-200">
      <div className="px-6 py-4 border-b border-amber-200 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-800">매칭 필요</h2>
        <p className="mt-1 text-xs text-amber-700">
          옵션이 등록되지 않아 구성품 전개가 불가한 주문입니다. 옵션을 등록해 주세요.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left font-medium">옵션 ID</th>
            <th className="px-4 py-3 text-left font-medium">상품명</th>
            <th className="px-4 py-3 text-right font-medium">발주가능</th>
            <th className="px-4 py-3 text-right font-medium">주문 수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order.externalItemId} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-700">{order.externalItemId}</td>
              <td className="px-4 py-3 text-gray-900">{order.itemName}</td>
              <td className="px-4 py-3 text-right text-gray-700">{order.purchasableQty}</td>
              <td className="px-4 py-3 text-right text-gray-700">{order.orderCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
