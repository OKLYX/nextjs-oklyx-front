'use client';

import type { PlatformFixedCost } from '@/domain/entities/FixedCost';
import { formatFixedCostAmount } from '@/domain/entities/FixedCost';
import { platformLabel } from '@/domain/entities/Settlement';

interface FixedCostTableProps {
  items: PlatformFixedCost[];
  isLoading: boolean;
  onEditClick: (item: PlatformFixedCost) => void;
  onDeleteClick: (item: PlatformFixedCost) => void;
}

function SkeletonRow() {
  return (
    <tr className="border-b">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );
}

const HEADERS = ['플랫폼', '항목명', '월 금액', '부과 임계', '상태', '액션'];

/** 고정비 카탈로그 목록. 금액·임계의 소유자는 이 화면이다(PLAN 2609_33 D1). */
export function FixedCostTable({ items, isLoading, onEditClick, onDeleteClick }: FixedCostTableProps) {
  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      <table className="w-full" role="grid" aria-label="채널 고정비 목록">
        <thead className="bg-gray-100 border-b">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={HEADERS.length} className="px-6 py-12 text-center text-gray-600">
                등록된 고정비 항목이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((item) => (
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
