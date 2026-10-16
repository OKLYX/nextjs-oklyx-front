'use client';

/**
 * 「우리 기록」 badge — marks a pickup invoice that **did not reach the marketplace** (FEATURE_2609_70 / D12).
 *
 * **Purpose**: shows a claim whose pickup invoice the marketplace (Coupang · 11st, FEATURE_2610_17 / D22) rejected
 * and that only our DB kept (`collectInvoiceSource === 'LOCAL'`) in the same words on the list and the detail. Two
 * screens with their own wording would make the same fact read differently.
 *
 * **File**: `src/app/dashboard/orders/claims/components/LocalRecordBadge.tsx`
 *
 * **Usage**:
 * ```tsx
 * // list pickup-invoice column
 * {claim.collectInvoiceNo ?? '-'}
 * {claim.collectInvoiceSource === 'LOCAL' && <LocalRecordBadge />}
 *
 * // detail 「회수송장」 row (with the explaining tooltip)
 * {claim.collectInvoiceSource === 'LOCAL' && <LocalRecordBadge title="마켓에는 반영되지 않았습니다" />}
 * ```
 *
 * ⚠️ `null` · `PLATFORM` draw **nothing** — when the normal case is noisy the odd one goes unseen. That is why this
 *    component takes no source value (the caller draws it only for `LOCAL`).
 * ❌ Do not let this badge stand in for the resend button ([쿠팡에 다시 보내기] / [마켓에 다시 보내기]) — what can be
 *    pressed is decided by the server's `availableActions` (2609_21 D1).
 */
export function LocalRecordBadge({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 whitespace-nowrap"
    >
      우리 기록
    </span>
  );
}
