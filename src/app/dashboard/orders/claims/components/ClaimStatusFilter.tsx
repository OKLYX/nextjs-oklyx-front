'use client';

import { CLAIM_STATUS_LABEL } from '@/domain/entities/ClaimEntity';
import type { ClaimStatus } from '@/domain/entities/ClaimEntity';

interface ClaimStatusFilterProps {
  // Which chips to show — the container derives this from the active tab
  statuses: ClaimStatus[];
  // null = 전체 (no filter)
  selectedStatus: ClaimStatus | null;
  onStatusChange: (status: ClaimStatus | null) => void;
  // Item count per status code
  counts: Partial<Record<ClaimStatus, number>>;
  // Count for the 전체 chip
  totalCount: number;
}

// Chip styling mirrors OrderStatusFilter. Which statuses get a chip is the container's decision
// (it differs per claim type) — this component never branches on the tab itself.
export function ClaimStatusFilter({
  statuses,
  selectedStatus,
  onStatusChange,
  counts,
  totalCount,
}: ClaimStatusFilterProps) {
  const chips: { status: ClaimStatus | null; label: string; count: number }[] = [
    { status: null, label: '전체', count: totalCount },
    ...statuses.map((status) => ({
      status,
      label: CLAIM_STATUS_LABEL[status],
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const isActive = selectedStatus === chip.status;
        return (
          <button
            key={chip.status ?? 'ALL'}
            type="button"
            onClick={() => onStatusChange(chip.status)}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {chip.label}
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-5 px-1.5 text-xs font-semibold rounded-full ${
                isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
