'use client';

import { ORDER_PROGRESS_STEPS, formatPaidClock, getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { OrderStatus } from '@/domain/entities/OrderEntity';

type StepState = 'past' | 'current' | 'future' | 'cancelled';

const DOT_CLASS: Record<StepState, string> = {
  past: 'bg-blue-600',
  current: 'bg-blue-600',
  future: 'border border-gray-300 bg-white',
  cancelled: 'bg-red-600',
};

const TEXT_CLASS: Record<StepState, string> = {
  past: 'text-sm text-gray-500',
  current: 'text-sm font-semibold text-gray-900',
  future: 'text-sm text-gray-500',
  cancelled: 'text-sm font-semibold text-red-700',
};

/**
 * Progress strip of the order detail (FEATURE_2611_29 / D2 · D19 ⑩ · R5) — five steps from 「결제완료」 to 「배송완료」.
 * The current step is a filled dot with bold text, past steps are filled dots, later steps are empty dots.
 * A fully canceled line shows 「취소됨」 in red in the second slot; the first slot is then past, the rest later.
 * The paid clock (`HH:mm`) shows under 「결제완료」 only once that step is past, wide screens only.
 *
 * **File**: src/app/dashboard/orders/components/OrderProgress.tsx
 * Used by: `OrderDetailsModal` (line mode) only — props in, no data loading.
 * ❌ Do not use it outside the order detail (FEATURE_2611_29 / D2 · D7 · D15).
 *
 * @example <OrderProgress status={shownStatus} paidAt={detail.paidAt} />
 */
export function OrderProgress({ status, paidAt }: { status: OrderStatus; paidAt: string | null }) {
  const currentIndex = ORDER_PROGRESS_STEPS.indexOf(status);
  const isCancelled = status === 'CANCELLED';
  const paidClock = formatPaidClock(paidAt);

  const stateOf = (index: number): StepState => {
    if (isCancelled) {
      if (index === 0) return 'past';
      return index === 1 ? 'cancelled' : 'future';
    }
    if (index < currentIndex) return 'past';
    return index === currentIndex ? 'current' : 'future';
  };

  return (
    <div className="grid grid-cols-5 gap-1">
      {ORDER_PROGRESS_STEPS.map((step, index) => {
        const state = stateOf(index);
        return (
          <div key={step} className="flex flex-col items-center gap-1 text-center">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT_CLASS[state]}`} aria-hidden />
            <span className={TEXT_CLASS[state]}>{state === 'cancelled' ? '취소됨' : getOrderStatusLabel(step)}</span>
            {index === 0 && state === 'past' && paidClock !== '' && (
              <span className="hidden text-xs text-gray-500 md:block">{paidClock}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
