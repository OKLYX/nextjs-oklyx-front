'use client';

import type { ReactNode } from 'react';

interface OrderNextStepCardProps {
  title: string;
  /** One line under the title — omitted = title only */
  body?: ReactNode;
  /** Buttons and done words, right of the text (below it on narrow screens) */
  children?: ReactNode;
  /** Error and notice boxes, full card width under the first row (each box keeps its own `mt-4`) */
  messages?: ReactNode;
}

/**
 * The 「다음 단계」 card of the order detail (FEATURE_2611_29 / D7 · D15 · R8 · R19) — an amber card under the progress
 * strip: title + one body line on the left, the buttons on the right (stacked below the text on narrow screens), and
 * the result / error boxes across the full width under them.
 *
 * **File**: src/app/dashboard/orders/components/OrderNextStepCard.tsx
 * Used by: `OrderDetailsModal` (line mode) only — props in, no data loading.
 * ❌ Do not use it outside the order detail (FEATURE_2611_29 / D2 · D7 · D15).
 *
 * @example
 * <OrderNextStepCard title={step.title} body={step.body} />
 * <OrderNextStepCard title={title} body={notice} messages={errorBoxes}>{buttons}</OrderNextStepCard>
 */
export function OrderNextStepCard({ title, body, children, messages }: OrderNextStepCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3 max-md:flex-col">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {body && <div className="mt-1 text-sm text-gray-600">{body}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      </div>
      {messages}
    </div>
  );
}
