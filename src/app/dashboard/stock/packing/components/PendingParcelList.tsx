'use client';

import { useEffect, useRef } from 'react';
import { TableCard } from '@/presentation/components/ui/TableCard';
import type { PendingParcel } from '@/domain/entities/PackingEntity';

/**
 * 작업 대상 박스 목록 (FEATURE_2609_40 / PLAN D16 · D31 · 2609_53/D6).
 *
 * 🔴 목록은 **서버가 잔량으로 이미 걸러서** 준다(D31) — 여기서 다시 거르거나 날짜로 자르지 않는다.
 * 자동 새로고침도 없다(폴링 금지) — 박스를 닫을 때 페이지가 다시 부른다.
 * 🔴 `selectedParcelId` = ↑↓ 로 고른 줄. **DOM 포커스가 아니다**(2609_53/D5) — 선택은 state 로만
 * 표시하고 Enter 의 주인은 언제나 페이지 하나다. 선택된 줄만 보이게 스크롤을 따라가게 한다.
 */
export interface PendingParcelListProps {
  parcels: PendingParcel[];
  loading: boolean;
  onOpen: (invoiceNumber: string) => void;
  /** ↑↓ 로 고른 줄. `null` = 선택 표시 없음(시작 화면 = 전역 키가 꺼져 있는 상태) */
  selectedParcelId: number | null;
}

/** 주문 시각으로부터 지난 시간. 목록에서 오래 묵은 박스를 눈에 띄게 하려는 값이다 */
const elapsed = (orderedAt: string | null): string => {
  if (!orderedAt) return '-';
  const ordered = new Date(orderedAt).getTime();
  if (Number.isNaN(ordered)) return '-';
  const minutes = Math.floor((Date.now() - ordered) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
};

export function PendingParcelList({
  parcels,
  loading,
  onOpen,
  selectedParcelId,
}: PendingParcelListProps) {
  // 목록이 길면 고른 줄이 화면 밖으로 나간다 → 그 줄만 보이게 끌어온다(포커스 이동이 아니다)
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedParcelId]);

  return (
    <TableCard
      isLoading={loading}
      isEmpty={parcels.length === 0}
      emptyMessage="작업할 박스가 없습니다"
    >
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700">송장</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">택배사</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">박스</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">주문</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">판매자</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">남음</th>
            <th className="px-4 py-2 text-center font-medium text-gray-700">경과</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((parcel) => {
            const selected = parcel.parcelId === selectedParcelId;
            return (
            <tr
              key={parcel.parcelId}
              ref={selected ? selectedRowRef : undefined}
              className={`border-b border-gray-100 hover:bg-gray-50 ${
                selected ? 'bg-blue-50 ring-1 ring-inset ring-blue-400' : ''
              }`}
            >
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={(event) => {
                    // 포커스를 남기면 다음 Enter 가 이 버튼을 다시 누른다.
                    event.currentTarget.blur();
                    onOpen(parcel.invoiceNumber);
                  }}
                  className="font-mono text-blue-600 hover:underline"
                >
                  {parcel.invoiceNumber}
                </button>
              </td>
              <td className="px-4 py-2 text-gray-700">{parcel.carrierName ?? '-'}</td>
              <td className="px-4 py-2 text-gray-700">
                {parcel.totalParcels > 1
                  ? `${parcel.totalParcels}박스 중 ${parcel.parcelSeq ?? '-'}번째`
                  : '1박스'}
              </td>
              <td className="px-4 py-2 text-gray-700">{parcel.externalOrderId}</td>
              <td className="px-4 py-2 text-gray-700">{parcel.sellerName ?? '-'}</td>
              <td className="px-4 py-2 text-center font-semibold text-gray-900">
                {parcel.remainingQty}
              </td>
              <td className="px-4 py-2 text-center text-gray-500">{elapsed(parcel.orderedAt)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
