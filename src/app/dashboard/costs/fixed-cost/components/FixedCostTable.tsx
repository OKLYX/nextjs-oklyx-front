'use client';

import type { PlatformFixedCost } from '@/domain/entities/FixedCost';
import { formatFixedCostAmount } from '@/domain/entities/FixedCost';
import { platformLabel } from '@/domain/entities/Settlement';
import { TableCard } from '@/presentation/components/ui/TableCard';

interface FixedCostTableProps {
  items: PlatformFixedCost[];
  isLoading: boolean;
  onEditClick: (item: PlatformFixedCost) => void;
  onDeleteClick: (item: PlatformFixedCost) => void;
}

const HEADERS = ['플랫폼', '항목명', '월 금액', '부과 임계', '상태', '액션'];

/** 고정비 카탈로그 목록. 금액·임계의 소유자는 이 화면이다(PLAN 2609_33 D1). */
export function FixedCostTable({ items, isLoading, onEditClick, onDeleteClick }: FixedCostTableProps) {
  return (
    <TableCard
      isLoading={isLoading}
      isEmpty={items.length === 0}
      emptyMessage="등록된 고정비 항목이 없습니다."
    >
      <table className="w-full" role="grid" aria-label="채널 고정비 목록">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="px-6 py-3 text-sm text-gray-900">{platformLabel(item.platform)}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-6 py-3 text-sm text-gray-900">
                {formatFixedCostAmount(item.amount)}원
              </td>
              <td className="px-6 py-3 text-sm text-gray-900">
                {formatFixedCostAmount(item.thresholdAmount)}원
              </td>
              <td className="px-6 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.active ? '사용' : '중지'}
                </span>
              </td>
              <td className="px-6 py-3 text-sm">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditClick(item)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDeleteClick(item)}
                    className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
