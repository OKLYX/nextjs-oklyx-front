'use client';

import type { SalesLine } from '@/domain/entities/SalesSummary';
import { formatMoney } from '@/domain/entities/SalesSummary';

/**
 * 판매 내역 — 이 채널의 매출이 <b>어느 주문에서</b> 나왔는지 (FEATURE_2609_34).
 *
 * 🔴 <b>이 목록이 이 화면의 답이다.</b> 위의 합계와 상품별 요약은 "얼마나·무엇이"를 말하지만, 그 숫자가
 * 어디서 왔는지는 여기서만 보인다 — 주문번호가 있어야 마켓 관리자 화면과 대조할 수 있다.
 *
 * 🔴 <b>취소·환불대기 라인을 숨기지 않는다.</b> 취소분은 유효수량에서 이미 빠져 있고(금액도 그만큼 작다),
 * 환불대기는 아직 확정이 아니라 매출에 남아 있다(D14). 숨기면 합계가 안 맞는 이유가 화면에서 사라진다.
 *
 * ⚠️ 금액은 서버가 집계와 같은 식으로 계산해 준 값이다 — 단가 × 수량을 화면에서 다시 곱하지 말 것.
 * ⚠️ 합계 줄을 만들지 않는다 — 위 요약이 서버가 계산한 합계다.
 */
interface ChannelSaleRecordsProps {
  rows: SalesLine[];
  isLoading: boolean;
  error: string;
}

/** `2026-09-04T10:32:11` → `09-04 10:32`. 값이 없으면 `—`. */
function formatSoldAt(value: string | null): string {
  if (!value) return '—';
  const [date, time] = value.split('T');
  return `${date.slice(5)} ${(time ?? '').slice(0, 5)}`.trim();
}

export function ChannelSaleRecords({ rows, isLoading, error }: ChannelSaleRecordsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-6 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="bg-white rounded-lg shadow px-6 py-4 text-sm text-red-600">{error}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-sm text-gray-500">
        이 기간에 이 채널에서 판매된 주문이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">판매일</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">주문번호</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">상품</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-900">수량</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-900">단가</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-900">매출액</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-900">할인</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row.orderLineId} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-500">{formatSoldAt(row.orderedAt)}</td>
              <td className="px-4 py-2 text-gray-700 tabular-nums">{row.externalOrderId}</td>
              <td className="px-4 py-2 text-gray-700">
                {row.itemName ?? '—'}
                {row.masterProductName == null && (
                  <span
                    className="ml-1 text-gray-400"
                    title="채널 옵션에 연결되지 않은 주문입니다. 매출에는 포함됩니다"
                  >
                    (상품 미연결)
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right text-gray-700">
                {row.netQty.toLocaleString('ko-KR')}
                {row.cancelQty > 0 && (
                  <span className="ml-1 text-xs text-gray-400" title="취소 확정 수량입니다">
                    (취소 {row.cancelQty})
                  </span>
                )}
                {row.holdQty > 0 && (
                  <span
                    className="ml-1 text-xs text-gray-500"
                    title="환불대기 수량입니다. 아직 확정이 아니라 매출에서 빼지 않았습니다"
                  >
                    (대기 {row.holdQty})
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right text-gray-500">{formatMoney(row.unitPrice)}</td>
              <td className="px-4 py-2 text-right font-semibold text-gray-900">
                {formatMoney(row.grossSales)}
              </td>
              <td className="px-4 py-2 text-right text-gray-500">{formatMoney(row.discount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
