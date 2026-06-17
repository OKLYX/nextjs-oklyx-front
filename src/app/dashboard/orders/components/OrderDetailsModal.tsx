'use client';

import type { OrderItem } from '@/domain/entities/OrderEntity';

interface OrderDetailsModalProps {
  order: OrderItem | null;
  onClose: () => void;
}

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

export function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  if (order == null) return null;

  // No detail API exists — display the row's fields read-only
  const fields: { label: string; value: string | number }[] = [
    { label: '플랫폼', value: order.platform },
    { label: '주문번호', value: order.externalOrderId },
    { label: '박스 ID', value: order.externalBoxId ?? '-' },
    { label: '아이템 ID', value: order.externalItemId },
    { label: '상품명', value: order.itemName ?? '-' },
    { label: '주문수량', value: order.orderCount },
    { label: '취소수량', value: order.cancelCount },
    { label: '보류수량', value: order.holdCount },
    { label: '구매가능수량', value: order.purchasableQty },
    { label: '상태', value: order.status },
    { label: '결제일', value: formatDate(order.paidAt) },
    { label: '마켓 계정 ID', value: order.marketplaceAccountId },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full mx-4">
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">주문 상세</h3>
        <dl className="divide-y divide-gray-200">
          {fields.map((field) => (
            <div key={field.label} className="flex justify-between py-2">
              <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
              <dd className="text-sm text-gray-900 text-right">{field.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-400 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
