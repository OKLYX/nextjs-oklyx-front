'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Card } from '@/presentation/components/ui/Card';
import { Spinner } from '@/presentation/components/Spinner';
import type { CardData } from './useCardData';

/** Class of the remove button — the grid does not start a drag on it (`dragConfig.cancel`). */
export const REMOVE_BUTTON_CLASS = 'dashboard-card-remove';

/** Class of the in-card selectors (seller · period · 「전체 | 채널」) — the same as the list screens' small selects. */
export const CARD_SELECT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500';

interface DashboardCardFrameProps {
  title: string;
  /** Screen a tap opens outside edit mode (D21). */
  href: string;
  editing: boolean;
  onRemove: () => void;
  /** Controls at the right end of the title row (seller selector · period selector · 「전체 | 채널」). */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Frame of the dashboard cards (FEATURE_2610_29 D16 · D21): white card, title row, body.
 *
 * - Outside edit mode a tap opens `href`; the controls in `action` and in the body stop the tap themselves.
 * - In edit mode the card does not navigate, its controls are inert, and ✕ removes the card.
 *
 * ❌ No size or padding knob — the size comes from the grid (D10).
 */
export function DashboardCardFrame({ title, href, editing, onRemove, action, children }: DashboardCardFrameProps) {
  const router = useRouter();

  return (
    <Card padded={false} className="h-full">
      <div
        onClick={editing ? undefined : () => router.push(href)}
        className={`flex h-full flex-col gap-1 p-3 ${editing ? 'cursor-move' : 'cursor-pointer'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-600">{title}</p>
          <div className="flex shrink-0 items-center gap-1">
            {action && <div className={editing ? 'pointer-events-none opacity-50' : undefined}>{action}</div>}
            {editing && (
              <button
                type="button"
                aria-label="카드 빼기"
                onClick={onRemove}
                className={`${REMOVE_BUTTON_CLASS} rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900`}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className={`min-h-0 flex-1 ${editing ? 'pointer-events-none' : ''}`}>{children}</div>
      </div>
    </Card>
  );
}

/** Loading / failure text of a card body; `children` renders the loaded data. */
export function CardBody<T>({ data, children }: { data: CardData<T>; children: (value: T) => ReactNode }) {
  if (data.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <Spinner />
      </div>
    );
  }
  if (data.status === 'error') {
    return <p className="text-sm text-red-600">{data.message}</p>;
  }
  return <>{children(data.data)}</>;
}

/** Stops a tap on a control from opening the card's screen. */
export function stopTap(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}
