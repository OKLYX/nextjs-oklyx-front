'use client';

import { ORDER_STATUSES, getOrderStatusLabel, CANCELED_FILTER } from '@/domain/entities/OrderEntity';

interface OrderStatusFilterProps {
  // null means no filter is active (show all). CANCELED_FILTER selects fully-canceled orders.
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  // Item count per status code, keyed by status (fully-canceled orders excluded)
  counts: Record<string, number>;
  // Count of fully-canceled orders, shown on the dedicated 취소항목 chip
  canceledCount: number;
}

// Renders the order-status filter chips between the search card and the list.
// The 6 status chips are followed by a dedicated 취소항목 chip that isolates
// fully-canceled orders (orderCount === cancelCount) out of the normal statuses.
// Each chip shows its item count; clicking the active chip again clears the filter.
export function OrderStatusFilter({
  selectedStatus,
  onStatusChange,
  counts,
  canceledCount,
}: OrderStatusFilterProps) {
  const isCanceledActive = selectedStatus === CANCELED_FILTER;
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => {
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
    </div>
  );
}
