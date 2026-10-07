'use client';

import type { InternalStage, OrderItem } from '@/domain/entities/OrderEntity';
import { INTERNAL_STAGE_LABELS } from '@/domain/entities/OrderEntity';

/** 2nd-row chip value under PAID on the shipment page (FEATURE_2610_07 / D10·D11). */
export type PaidStage = 'ALL' | 'BEFORE_ACK' | InternalStage;

// Stage labels come from INTERNAL_STAGE_LABELS — only the first two labels are new here (D12).
const PAID_STAGES: { key: PaidStage; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'BEFORE_ACK', label: '발주 전' },
  { key: 'INTERNAL_PREPARING', label: INTERNAL_STAGE_LABELS.INTERNAL_PREPARING },
  { key: 'AWAITING_SHIPMENT', label: INTERNAL_STAGE_LABELS.AWAITING_SHIPMENT },
];

/**
 * Whether a PAID order falls under the chip. Callers pass PAID orders only.
 * The stage is the server's `internalStage` as is — never re-derived from status or invoices (D11).
 */
export function matchesPaidStage(order: OrderItem, stage: PaidStage): boolean {
  if (stage === 'ALL') return true;
  if (stage === 'BEFORE_ACK') return order.internalStage == null;
  return order.internalStage === stage;
}

interface PaidStageFilterProps {
  /** PAID orders after the channel and search filters, before any chip — every chip count comes from here (D13). */
  orders: OrderItem[];
  selected: PaidStage;
  onChange: (stage: PaidStage) => void;
}

/**
 * Shipment page 2nd-row chips, rendered only while the PAID chip is on (FEATURE_2610_07 / D10).
 *
 * **Purpose**: split PAID orders by the server's internal stage. Single choice; the 'ALL' chip is the default.
 * **File**: src/app/dashboard/orders/shipment/components/PaidStageFilter.tsx
 * ⚠️ Same pill as `OrderStatusFilter` — the class strings are copied, not shared (that component is also used by the order history page).
 * ❌ Clicking the active chip does nothing — there is no clear-by-reclick here (D10).
 */
export function PaidStageFilter({ orders, selected, onChange }: PaidStageFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAID_STAGES.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (!isActive) onChange(key);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {label}
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-5 px-1.5 text-xs font-semibold rounded-full ${
                isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {orders.filter((order) => matchesPaidStage(order, key)).length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
