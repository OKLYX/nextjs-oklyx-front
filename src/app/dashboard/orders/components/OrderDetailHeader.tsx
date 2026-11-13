'use client';

import { RotateCw } from 'lucide-react';
import { CopyIdButton } from '@/app/dashboard/master-products/[id]/components/CopyIdButton';
import { platformName } from '@/config/platforms';
import { formatMarketRelativeTime } from '@/domain/entities/DateTimeFormat';
import { ELEVENST_RESERVED_LABEL, formatPaidAt, getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { InternalStage, OrderDetail } from '@/domain/entities/OrderEntity';
import { Spinner } from '@/presentation/components/Spinner';
import { InternalStageBadge } from './InternalStageBadge';
import { formatAmount } from './OrderDetailSummary';

interface OrderDetailHeaderProps {
  detail: OrderDetail;
  /** Shown status of the clicked line (R7) — null = no status badge (packing entry) */
  status: string | null;
  reservedSale: boolean;
  stage: InternalStage | null;
  /** Order amount of the clicked line (narrow screens) — null = not shown (packing entry, or unknown) */
  amount: number | null;
  /** null = no refresh button */
  onRefresh: (() => void) | null;
  isRefreshing: boolean;
}

/**
 * Refresh button of the order detail (FEATURE_2611_29 / D4 supplement · R3) — icon + 「상태 갱신」 on wide screens, icon only on
 * narrow screens; a spinner while the refresh runs.
 *
 * **File**: src/app/dashboard/orders/components/OrderDetailHeader.tsx
 * Used by: `OrderDetailHeader` (header right side) and `OrderDetailsModal` while the detail is not loaded (beside the
 * load failure text) — two places only.
 * ❌ Do not use it outside the order detail.
 */
export function OrderRefreshButton({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label="주문 상태 갱신"
      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
    >
      {isRefreshing ? (
        <Spinner label="확인 중..." />
      ) : (
        <>
          <RotateCw size={14} aria-hidden />
          <span className="hidden md:inline">상태 갱신</span>
        </>
      )}
    </button>
  );
}

/**
 * Header of the order detail (FEATURE_2611_29 / D4 · D10 · D33 · R4 · R6 · R19) — three lines pinned above the scrolling
 * band: market badge · alias · seller / order number + copy + status badges / paid time (+ relative time while paid or
 * preparing). Narrow screens move the status badges to line 1, drop the seller and the 「주문 」 prefix, use the short
 * paid time and add the order amount; the refresh button sits at the right end of line 1 (narrow) or right of the block.
 *
 * **File**: src/app/dashboard/orders/components/OrderDetailHeader.tsx
 * Used by: `OrderDetailsModal` (both modes) only — props in, no data loading.
 * ❌ Do not use it outside the order detail (FEATURE_2611_29 / D2 · D7 · D15).
 *
 * @example
 * <OrderDetailHeader detail={detail} status={shownStatus} reservedSale={line.reservedSale} stage={shownStage}
 *   amount={orderNetAmount(line.lineAmount, line.discountAmount)} onRefresh={null} isRefreshing={false} />
 */
export function OrderDetailHeader({
  detail,
  status,
  reservedSale,
  stage,
  amount,
  onRefresh,
  isRefreshing,
}: OrderDetailHeaderProps) {
  const alias = detail.accountAlias?.trim() ?? '';
  const showRelative = (status === 'PAID' || status === 'PREPARING') && detail.paidAt != null;
  const statusBadges = status == null ? null : (
    <>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
          status === 'CANCELLED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
        }`}
      >
        {getOrderStatusLabel(status) + (reservedSale ? ` · ${ELEVENST_RESERVED_LABEL}` : '')}
      </span>
      <InternalStageBadge stage={stage} />
    </>
  );

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {detail.platform == null ? '-' : platformName(detail.platform)}
            </span>
            {alias !== '' && <span>{alias}</span>}
            {detail.sellerName && <span className="hidden text-gray-500 md:inline">{detail.sellerName}</span>}
          </div>
          {statusBadges && <span className="inline-flex shrink-0 items-center md:hidden">{statusBadges}</span>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="break-all text-base font-semibold text-gray-900">
            <span className="hidden md:inline">주문 </span>
            {detail.externalOrderId}
          </span>
          <CopyIdButton value={detail.externalOrderId} />
          {statusBadges && <span className="hidden items-center md:inline-flex">{statusBadges}</span>}
        </div>
        <p className="text-sm text-gray-500">
          결제 <span className="hidden md:inline">{formatPaidAt(detail.paidAt, true)}</span>
          <span className="md:hidden">{formatPaidAt(detail.paidAt, false)}</span>
          {showRelative && ` · ${formatMarketRelativeTime(detail.paidAt)}`}
          {amount != null && <span className="md:hidden">{` · ${formatAmount(amount)}`}</span>}
        </p>
      </div>
      {onRefresh != null && (
        <div className="shrink-0">
          <OrderRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
        </div>
      )}
    </div>
  );
}
