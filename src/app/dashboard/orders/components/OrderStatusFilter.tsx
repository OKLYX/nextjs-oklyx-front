'use client';
import { useEffect, useRef } from 'react';

import { ORDER_STATUSES, getOrderStatusLabel, CANCELED_FILTER } from '@/domain/entities/OrderEntity';

interface OrderStatusFilterProps {
  // null means no filter is active (show all). CANCELED_FILTER selects fully-canceled orders.
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  // Item count per status code, keyed by status (fully-canceled orders excluded)
  counts: Record<string, number>;
  // Count of fully-canceled orders, shown on the dedicated 취소항목 chip.
  // Required even when the chip is hidden — pass 0 there.
  canceledCount: number;
  /** 그릴 상태 후보. 기본값 = 전 상태(주문내역). 출고관리는 SHIPMENT_STATUSES 만 넘긴다. */
  statuses?: readonly string[];
  /** 취소항목 칩 표시 여부. 출고관리는 취소를 아예 제외하므로 false. */
  showCanceledChip?: boolean;
  /** 「전체」 tab count = the list when no chip is on (FEATURE_2611_32 / D26). */
  allCount: number;
  /** true = the narrow tabs share the width (「출고관리」). */
  equalWidth?: boolean;
}

// Renders the order-status filter chips between the search card and the list.
// The status chips are followed by a dedicated 취소항목 chip that isolates
// fully-canceled orders (server-decided `cancelled`) out of the normal statuses.
// Each chip shows its item count; clicking the active chip again clears the filter
// (there is no '전체' chip — re-clicking the active one is how you clear it).
// Wide screens: the chips as before (re-click clears, no 「전체」 chip). Below 768px: underline tabs with count
// badges, a leading 「전체」 tab (= no chip), and re-tapping the picked tab does nothing; the tab row scrolls
// sideways so the picked tab sits near the middle (FEATURE_2611_32 / D26 · D7 · D4-14).
//
// 후보(`statuses`)와 취소 칩(`showCanceledChip`)만 선택적으로 좁힐 수 있다(PLAN 2609_15 D12).
// 기본값이 현행이라 주문내역 렌더는 무변경이고, 출고관리는 후보 2종 + 취소 칩 숨김으로 쓴다.
export function OrderStatusFilter({
  selectedStatus,
  onStatusChange,
  counts,
  canceledCount,
  statuses = ORDER_STATUSES,
  showCanceledChip = true,
  allCount,
  equalWidth = false,
}: OrderStatusFilterProps) {
  const isCanceledActive = selectedStatus === CANCELED_FILTER;
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const active = activeRef.current;
    if (equalWidth || scroller == null || active == null) return;
    // scrollIntoView would also move the window vertically — scroll only the tab row.
    scroller.scrollTo({
      left: active.offsetLeft - (scroller.clientWidth - active.clientWidth) / 2,
      behavior: 'smooth',
    });
  }, [selectedStatus, equalWidth]);

  const tabs: { value: string | null; label: string; count: number }[] = [
    { value: null, label: '전체', count: allCount },
    ...statuses.map((s) => ({ value: s, label: getOrderStatusLabel(s), count: counts[s] ?? 0 })),
    ...(showCanceledChip ? [{ value: CANCELED_FILTER, label: '취소항목', count: canceledCount }] : []),
  ];

  return (
    <>
    <div className="-mx-4 bg-white md:hidden">
      <div ref={scrollRef} className={equalWidth ? 'flex' : 'flex overflow-x-auto px-4'}>
        {tabs.map((tab) => {
          const isActive = selectedStatus === tab.value;
          return (
            <button
              type="button"
              key={tab.value ?? 'ALL'}
              ref={isActive ? activeRef : undefined}
              onClick={isActive ? undefined : () => onStatusChange(tab.value)}
              className={`flex h-12 items-center justify-center gap-1.5 text-[15px] ${isActive ? 'border-b-[3px] border-current font-bold text-gray-900' : 'border-b border-gray-200 font-normal text-gray-500'} ${equalWidth ? 'flex-1' : 'shrink-0 px-3'}`}
            >
              {tab.label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${isActive ? 'bg-brand text-on-brand' : 'bg-gray-200 text-gray-600'}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
    <div className="flex flex-wrap gap-2 max-md:hidden">
      {statuses.map((status) => {
        const isActive = selectedStatus === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onStatusChange(isActive ? null : status)}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {getOrderStatusLabel(status)}
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-5 px-1.5 text-xs font-semibold rounded-full ${
                isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {counts[status] ?? 0}
            </span>
          </button>
        );
      })}

      {showCanceledChip && (
      <button
        type="button"
        onClick={() => onStatusChange(isCanceledActive ? null : CANCELED_FILTER)}
        className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
          isCanceledActive
            ? 'bg-red-600 text-white border-red-600'
            : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
        }`}
      >
        취소항목
        <span
          className={`ml-2 inline-flex items-center justify-center min-w-5 px-1.5 text-xs font-semibold rounded-full ${
            isCanceledActive ? 'bg-white/25 text-white' : 'bg-red-100 text-red-600'
          }`}
        >
          {canceledCount}
        </span>
      </button>
      )}
    </div>
    </>
  );
}
