'use client';

import { ELEVENST_RESERVED_LABEL } from '@/domain/entities/OrderEntity';

/**
 * 「11번가 예약판매」 badge of an 11st reserved-sale paid order (FEATURE_2610_17 / D67).
 *
 * **Purpose**: the order list (`OrderTable`, shared by order history and shipment) draws it beside the order number,
 * in the same slot and shape as `InternalStageBadge`.
 * **File**: src/app/dashboard/orders/components/ElevenstReservedBadge.tsx
 * ⚠️ The text comes from `ELEVENST_RESERVED_LABEL` only. `reservedSale` is the server's flag — never read the raw
 * status code here.
 *
 * @example <ElevenstReservedBadge reservedSale={order.reservedSale} />
 */
export function ElevenstReservedBadge({ reservedSale }: { reservedSale: boolean }) {
  if (!reservedSale) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-gray-500">
      {ELEVENST_RESERVED_LABEL}
    </span>
  );
}
