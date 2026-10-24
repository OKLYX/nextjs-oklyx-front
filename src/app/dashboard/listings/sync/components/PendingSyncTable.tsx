'use client';

import type { PendingSyncResponse } from '@/domain/entities/ListingRegistrationEntity';
import { platformDisplayName } from '@/config/platforms';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';

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

  // Narrow-screen cards (FEATURE_2610_31 D13 · D22): the row checkbox at the top-left, every table column as
  // label · value.
  const renderCards = () =>
    rows.map((row) => (
      <DataCard
        key={row.productListingId}
        selection={{
          checked: selected.includes(row.productListingId),
          onChange: () => onToggle(row.productListingId),
          label: `${row.masterProductName} 선택`,
        }}
        fields={[
          { label: '마스터명', value: row.masterProductName },
          { label: '판매자', value: row.seller },
          { label: '플랫폼', value: platformDisplayName(row.platform) },
          {
            label: '상태',
            value: (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{row.status}</span>
            ),
          },
        ]}
      />
    ));

  return (
    <DataCardSwitch placement="page" renderCards={renderCards}>
    <table>
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr className="text-left text-sm text-gray-600">
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
            <td className="px-4 py-3">{platformDisplayName(row.platform)}</td>
            <td className="px-4 py-3">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {row.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </DataCardSwitch>
  );
}
