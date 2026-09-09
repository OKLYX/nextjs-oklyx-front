'use client';

import type { StockMovement } from '@/domain/entities/StockEntity';
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_REASON_LABELS,
} from '@/domain/entities/StockEntity';

/**
 * 재고 원장 이력 표 (FEATURE_2609_28).
 *
 * **용도**: 입고·조정 화면의 최근 이력과 재고 조회 화면의 행 펼침이 <b>같이 쓰는</b> 표.
 * **필수 규칙**: 이력을 그리는 화면이 생기면 이 컴포넌트를 쓴다 — 부호 색·라벨 규칙을 복제하지 않는다.
 * **파일**: src/app/dashboard/stock/components/StockMovementTable.tsx
 *
 * **사용 예제**:
 * <StockMovementTable movements={movements} isLoading={isLoading} error={error} />
 * <StockMovementTable movements={movements} isLoading={false} error="" showSeller={false} />
 *
 * ⚠️ quantity 는 서버가 저장한 부호 그대로 그린다 — 화면에서 부호를 만들지 않는다(PLAN 2609_28 D6).
 * ⚠️ 처리자(createdBy)는 원장의 필수 정보다. 값이 없으면 '—' 로 비워 두되 열을 지우지 않는다(D9).
 */
interface StockMovementTableProps {
  movements: StockMovement[];
  isLoading: boolean;
  error: string;
  /** 이미 판매자로 좁혀진 문맥(잔량 행 펼침 등)에서는 열을 숨긴다. */
  showSeller?: boolean;
  emptyMessage?: string;
}

export function StockMovementTable({
  movements,
  isLoading,
  error,
  showSeller = true,
  emptyMessage = '이력이 없습니다.',
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

  return (
    <div className="list-table-scroll">
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
              <td className="px-4 py-2 text-sm text-gray-700">{movement.productName}</td>
              {showSeller && (
                <td className="px-4 py-2 text-sm text-gray-700">{movement.sellerName}</td>
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
    </div>
  );
}
