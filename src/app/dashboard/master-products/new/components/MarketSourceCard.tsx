'use client';

import { Card } from '@/presentation/components/ui/Card';
import { PLATFORM_LABEL, type MarketSource } from './marketSource';

// 상태 enum → 화면 문구(enum 원문을 사용자에게 노출하지 않는다). 가져오기 창과 같은 한 줄짜리 표지만,
// 서로 import 하면 화면 간 결합이 생기므로 지역으로 둔다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

/**
 * 3단 페이지 「새 마스터」 모드의 출발 마켓 상품 요약(2609_79 / UX D77).
 * File: src/app/dashboard/master-products/new/components/MarketSourceCard.tsx
 *
 * 옵션별 판매가·재고는 **읽기 전용**이다 — 판매상품을 붙일 때 서버가 마켓을 다시 읽어 확정한다.
 * ❌ 판매가·재고 입력칸을 만들지 말 것.
 */
export function MarketSourceCard({ market }: { market: MarketSource }) {
  const { preview } = market;
  const label = PLATFORM_LABEL[market.platform] ?? market.platform;
  return (
    <Card title="마켓 상품" className="mb-4 space-y-2">
      <p className="text-sm text-gray-900">
        <span className="font-medium">{preview.productName ?? '(이름 없음)'}</span>
        <span className="text-gray-500">
          {' '}
          · {label} 상품 ID {market.platformProductId} · {STATUS_LABEL[preview.status] ?? preview.status} ·
          옵션 {preview.options.length}개
        </span>
      </p>
      {preview.reusesExistingListing && (
        <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
          이 {label} 상품에는 마스터 연결이 끊긴 판매상품이 있습니다. 새로 만들지 않고 그 판매상품을 이
          마스터에 붙입니다 — 주문·고객문의·정산 기록이 함께 따라옵니다.
        </p>
      )}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{label} 옵션</th>
              <th className="px-2 py-1.5 text-right font-medium">판매가</th>
              <th className="px-2 py-1.5 text-right font-medium">재고</th>
            </tr>
          </thead>
          <tbody>
            {preview.options.map((o) => (
              <tr key={o.platformOptionId ?? o.itemName} className="border-t border-gray-100">
                <td className="px-2 py-1.5 text-gray-900">{o.itemName}</td>
                <td className="px-2 py-1.5 text-right text-gray-600">
                  {o.salePrice.toLocaleString('ko-KR')}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-600">{o.stockQuantity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        옵션은 {label} 상품 그대로 만들어지고 이름을 바꿀 수 없습니다 — 옵션마다 구성 수량만 입력하세요.
        판매가·재고는 {label} 값을 그대로 씁니다. 사진은 채우지 않으니 이미지 칸에 직접 올리세요. 저장하면
        마스터를 만든 뒤 이 상품을 판매상품으로 붙입니다.
      </p>
    </Card>
  );
}
