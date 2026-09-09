'use client';

import { useState } from 'react';
import type { OutboundOrder } from '@/domain/entities/StockEntity';
import { getOrderStatusLabel } from '@/domain/entities/OrderEntity';

interface OutboundOrderCardProps {
  order: OutboundOrder;
  /** 진행 중인 확인 키(`orderLineId:productId`). 누른 줄만 비활성된다. */
  pendingKey: string | null;
  errorKey: string | null;
  errorMessage: string;
  onConfirm: (orderLineId: number, productId: number, quantity: number) => void;
}

/**
 * 출고 대상 주문 라인 1건 (FEATURE_2609_28 / PLAN D11·D12).
 *
 * ⚠️ 확인은 <b>상품 줄마다 개별 요청</b>이다 — 모아서 보내면 중단 시 어디까지 했는지 잃는다(D12).
 * ⚠️ 남은 수량은 서버가 준 `필요 − 확인` 이다. 화면에서 다시 계산하지 않는다.
 */
export function OutboundOrderCard({
  order,
  pendingKey,
  errorKey,
  errorMessage,
  onConfirm,
}: OutboundOrderCardProps) {
  // 줄마다 입력 수량. 비어 있으면 남은 수량이 기본값이다.
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-gray-900">{order.externalOrderId}</span>
        <span className="text-gray-700">{order.itemName ?? '—'}</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
          {getOrderStatusLabel(order.status)}
        </span>
        <span className="text-xs text-gray-500">{order.sellerName}</span>
        <span className="text-xs text-gray-500">주문수량 {order.orderQty}</span>
        <span className="text-xs text-gray-400">{order.orderedAt?.slice(0, 10)}</span>
      </div>

      <div className="divide-y divide-gray-100">
        {order.products.map((product) => {
          const remaining = product.requiredQty - product.confirmedQty;
          const key = `${order.orderLineId}:${product.productId}`;
          const isPending = pendingKey === key;
          const value = quantities[product.productId] ?? String(Math.max(remaining, 0));

          return (
            <div key={product.productId} className="py-2 space-y-1">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-40 text-gray-800">{product.productName}</span>
                <span className="text-gray-600">필요 {product.requiredQty}</span>
                <span className="text-gray-600">확인 {product.confirmedQty}</span>
                <input
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [product.productId]: e.target.value }))
                  }
                  disabled={isPending || remaining <= 0}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => onConfirm(order.orderLineId, product.productId, Number(value))}
                  disabled={isPending || remaining <= 0}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isPending ? '확인 중...' : '확인'}
                </button>
              </div>
              {errorKey === key && errorMessage && (
                <p className="text-xs text-red-600">{errorMessage}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
