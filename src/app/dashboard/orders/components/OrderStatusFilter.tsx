'use client';

import { ORDER_STATUSES, getOrderStatusLabel } from '@/domain/entities/OrderEntity';

interface OrderStatusFilterProps {
  // null means no filter is active (show all)
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  // Item count per status code, keyed by status
  counts: Record<string, number>;
}

// Renders the 6 order-status filter buttons between the search card and the list.
// Each button shows the number of items in that status.
// Clicking the active button again clears the filter (shows all).
export function OrderStatusFilter({ selectedStatus, onStatusChange, counts }: OrderStatusFilterProps) {
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
    </div>
  );
}
