'use client';

import type { ProductProfit } from '@/domain/entities/SalesSummary';
import { PROFIT_PENDING_HINT, formatMoney, formatProfit } from '@/domain/entities/SalesSummary';
import { Card } from '@/presentation/components/ui/Card';
import { TableCard } from '@/presentation/components/ui/TableCard';

/** 정렬 가능한 축. 문자열 축(상품명)은 정렬하지 않는다 — 이 표의 질문은 "얼마 남나"다. */
export type ProductProfitSortKey = 'netQty' | 'grossSales' | 'estNetProfit';

interface ProductProfitTableProps {
  rows: ProductProfit[];
  /** 채널 컬럼 표시 여부 = `crossChannel === false`. */
  showChannel: boolean;
  sortKey: ProductProfitSortKey;
  sortDir: 'asc' | 'desc';
  loading: boolean;
  error: string;
  onSort: (key: ProductProfitSortKey) => void;
  onRetry: () => void;
}

const UNCATEGORIZED_HINT = '채널 옵션 연결이 없는 주문';

/**
 * 상품별 매출 표 (FEATURE_2609_30 / 04 Step 4).
 *
 * 🔴 `미분류` 행을 숨기지 않는다. 맨 아래 회색으로 남긴다 — 숨기면 이 목록의 합계가 판매자 요약과
 * 어긋나는 이유를 아무도 설명하지 못한다.
 *
 * ⚠️ 표시 전용이다. 정렬 상태·조회는 Container 가 소유한다(두 보기 방식이 같은 표를 재사용한다).
 */
export function ProductProfitTable({
  rows,
  showChannel,
  sortKey,
  sortDir,
  loading,
  error,
  onSort,
  onRetry,
}: ProductProfitTableProps) {
  if (error) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </Card>
    );
  }

  const sortMark = (key: ProductProfitSortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  return (
    <TableCard
      isLoading={loading && rows.length === 0}
      isEmpty={rows.length === 0}
      emptyMessage="해당 기간에 판매된 주문이 없습니다."
    >
      {loading && rows.length > 0 && (
        <div className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          조회 중...
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품</th>
            {showChannel && (
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">채널</th>
            )}
            <th
              onClick={() => onSort('netQty')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              판매수량{sortMark('netQty')}
            </th>
            <th
              onClick={() => onSort('grossSales')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              매출액{sortMark('grossSales')}
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">할인</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              수수료(추정)
            </th>
            <th
              onClick={() => onSort('estNetProfit')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              순이익(추정){sortMark('estNetProfit')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr
              key={`${row.masterProductId ?? 'uncategorized'}:${row.accountId ?? 'all'}`}
              className={row.uncategorized ? 'bg-gray-50 text-gray-500' : ''}
            >
              <td
                className="px-6 py-3 text-sm"
                title={row.uncategorized ? UNCATEGORIZED_HINT : undefined}
              >
                {row.masterProductName}
              </td>
              {showChannel && (
                <td className="px-6 py-3 text-sm text-gray-700">
                  {row.accountAlias?.trim()
                    ? row.accountAlias
                    : row.accountId != null
                      ? `채널 #${row.accountId}`
                      : '-'}
                </td>
              )}
              <td className="px-6 py-3 text-sm text-right">{row.netQty.toLocaleString('ko-KR')}</td>
              <td className="px-6 py-3 text-sm text-right font-semibold">
                {formatMoney(row.grossSales)}
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-500">
                {formatMoney(row.discount)}
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-500">
                {formatMoney(row.estFee)}
              </td>
              <td
                className="px-6 py-3 text-sm text-right"
                title={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
              >
                {formatProfit(row)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
