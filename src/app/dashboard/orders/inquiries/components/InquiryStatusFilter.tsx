'use client';

import { INQUIRY_STATUS_LABEL } from '@/domain/entities/InquiryEntity';
import type { InquiryStatus } from '@/domain/entities/InquiryEntity';

interface InquiryStatusFilterProps {
  // Which chips to show — the container passes INQUIRY_STATUS_FILTERS
  statuses: InquiryStatus[];
  // null = 전체 (no filter)
  selectedStatus: InquiryStatus | null;
  onStatusChange: (status: InquiryStatus | null) => void;
  // Item count per status code
  counts: Partial<Record<InquiryStatus, number>>;
  // Count for the 전체 chip
  totalCount: number;
}

/**
 * 상태 칩 — `ClaimStatusFilter` 와 같은 계약이다. 클릭은 **로컬 필터**라 요청을 만들지 않는다.
 *
 * ⚠️ 활성 칩을 다시 눌러도 해제되지 않는다(전체 칩이 그 역할). 그리고 `STALE` 은 칩이 없으므로
 * 칩 건수의 합이 전체 칩 건수보다 작을 수 있다 — 의도된 차이다.
 */
export function InquiryStatusFilter({
  statuses,
  selectedStatus,
  onStatusChange,
  counts,
  totalCount,
}: InquiryStatusFilterProps) {
  const chips: { status: InquiryStatus | null; label: string; count: number }[] = [
    { status: null, label: '전체', count: totalCount },
    ...statuses.map((status) => ({
      status,
      label: INQUIRY_STATUS_LABEL[status],
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
