'use client';

import { RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '@/domain/entities/DateTimeFormat';

interface OrderSyncPillProps {
  lastSyncedAt: string | null;
  hasIncompleteChannel: boolean;
  isSyncing: boolean;
  disabled: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
}

/**
 * Sync pill on the right of the page title below 768px (FEATURE_2611_32 / D6 · D20).
 *
 * **Purpose**: tapping it runs the same sync as the wide-screen green sync button. The dot is red when any
 * channel's last sync did not finish (`isSyncIncomplete`), green otherwise.
 * **File**: src/app/dashboard/orders/components/OrderSyncPill.tsx
 * ⚠️ The disabled condition comes from the screen — pass the screen's current sync-button condition as is (R14).
 * ⚠️ Wide screens keep the current 「마지막 동기화:」 text; render this with `className="md:hidden"`.
 *
 * @example
 * <OrderSyncPill className="md:hidden" lastSyncedAt={lastSyncedAt} hasIncompleteChannel={false}
 *   isSyncing={isSyncing} disabled={isSyncing} onClick={() => void handleSync()} />
 */
export function OrderSyncPill({
  lastSyncedAt,
  hasIncompleteChannel,
  isSyncing,
  disabled,
  title,
  onClick,
  className,
}: OrderSyncPillProps) {
  const text = isSyncing
    ? '동기화 중…'
    : lastSyncedAt
      ? `${formatRelativeTime(lastSyncedAt)} 동기화`
      : '동기화';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSyncing}
      title={title}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-[13px] text-gray-600 ${disabled && !isSyncing ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${hasIncompleteChannel ? 'bg-red-600' : 'bg-sync-ok'}`} />
      {text}
      <RefreshCw size={16} aria-hidden className={`text-gray-900 ${isSyncing ? 'animate-spin' : ''}`} />
    </button>
  );
}
