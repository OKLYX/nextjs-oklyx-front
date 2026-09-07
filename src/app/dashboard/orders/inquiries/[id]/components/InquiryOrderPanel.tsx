'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { Inquiry } from '@/domain/entities/InquiryEntity';

interface InquiryOrderPanelProps {
  inquiry: Inquiry;
}

// Same shape as InquiryTable.formatDate: null/parse failure must never paint a blank cell.
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm font-medium text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 text-right break-all">{value}</dd>
    </div>
  );
}

/**
 * 우측 패널 — 관련 주문 / 관련 상품(셀) / 빈 상태 3가지를 그린다.
 *
 * ❌ 금액을 표시하지 않는다 — `order_item` 에 가격 필드가 없다(01 Step 8 의 라인 필드가 전부).
 */
export function InquiryOrderPanel({ inquiry }: InquiryOrderPanelProps) {
  const router = useRouter();
  const order = inquiry.relatedOrder;
  const listing = inquiry.relatedListing;

  if (order) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">관련 주문</h2>

        <dl className="divide-y divide-gray-200">
          <Row label="주문번호" value={order.externalOrderId} />
          <Row label="결제일" value={formatDate(order.paidAt)} />
          <Row label="주문자" value={order.ordererName ?? '-'} />
          <Row label="수취인" value={order.receiverName ?? '-'} />
        </dl>

        <ul className="space-y-2">
          {order.lines.map((line) => (
            <li
              key={line.orderItemId}
              // 이 문의가 걸린 라인만 강조 — 합포장 주문이면 같은 주문의 다른 라인도 함께 보인다.
              className={`rounded-lg p-3 text-sm ${
                line.isInquiryLine
                  ? 'border-l-4 border-blue-500 bg-blue-50'
                  : 'border border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-900 break-words">{line.itemName ?? '-'}</span>
                <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                  {getOrderStatusLabel(line.status)}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                수량 {line.orderCount}
                {line.cancelCount > 0 && ` · 취소 ${line.cancelCount}`}
              </div>
              {line.isInquiryLine && (
                <span className="mt-2 inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                  이 문의의 상품
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* ⚠️ 주문내역에는 주문번호 딥링크가 없다 — 목록으로만 보낸다. */}
        <button
          type="button"
          onClick={() => router.push(ROUTES.ORDERS_RETRIEVE)}
          className="w-full px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          주문내역에서 찾기
        </button>
      </div>
    );
  }

  if (listing) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">관련 상품</h2>
        <p className="text-sm text-gray-500">
          이 문의는 주문과 연결되지 않았습니다. (구매 전 문의이거나 주문이 아직 적재되지 않았습니다)
        </p>
        <dl className="divide-y divide-gray-200">
          <Row label="판매상품" value={listing.listingName} />
          <Row label="옵션" value={listing.optionName ?? '-'} />
        </dl>
        <button
          type="button"
          onClick={() =>
            router.push(ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(listing.productListingId))
          }
          className="w-full px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          상품 상세로
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-500">
      연결된 주문·상품 정보가 없습니다.
    </div>
  );
}
