'use client';

import type { PendingSyncResponse } from '@/domain/entities/ListingRegistrationEntity';

interface PendingSyncTableProps {
  rows: PendingSyncResponse[];
  selected: number[];
  onToggle: (listingId: number) => void;
}

/**
 * 마켓 반영 대기(dirty) 목록 표. 다중선택 상태(selected)는 부모(sync/page)가 보유.
 * File: src/app/dashboard/listings/sync/components/PendingSyncTable.tsx
 */
export function PendingSyncTable({ rows, selected, onToggle }: PendingSyncTableProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-gray-500">반영 대기 중인 리스팅이 없습니다.</p>
    );
  }

  return (
    <table>
      <thead>
        <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
          <th className="px-4 py-3"></th>
          <th className="px-4 py-3">마스터명</th>
          <th className="px-4 py-3">판매자</th>
          <th className="px-4 py-3">플랫폼</th>
          <th className="px-4 py-3">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.productListingId} className="border-b border-gray-100 text-sm text-gray-900">
            <td className="px-4 py-3">
              <input
                type="checkbox"
                checked={selected.includes(row.productListingId)}
                onChange={() => onToggle(row.productListingId)}
              />
            </td>
            <td className="px-4 py-3">{row.masterProductName}</td>
            <td className="px-4 py-3">{row.seller}</td>
            <td className="px-4 py-3">{row.platform}</td>
            <td className="px-4 py-3">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {row.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
