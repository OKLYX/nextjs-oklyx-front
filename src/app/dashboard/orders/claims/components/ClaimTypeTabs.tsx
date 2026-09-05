'use client';

import { CLAIM_TYPE_LABEL } from '@/domain/entities/ClaimEntity';
import type { ClaimType } from '@/domain/entities/ClaimEntity';

/**
 * 반품 / 교환 탭. The tab is a **server** axis (`type` is a query parameter), unlike the status
 * chips below it, which filter the loaded list client-side — hence the underline shape instead of
 * the chip shape (mirrors `MetaPlatformTabs`).
 *
 * No per-tab count badge: the other tab was never fetched, so any number here would be a lie.
 */
interface ClaimTypeTabsProps {
  value: ClaimType;
  onChange: (type: ClaimType) => void;
  // Blocks double-clicks while a fetch is in flight
  disabled: boolean;
}

const TABS: ClaimType[] = ['RETURN', 'EXCHANGE'];

export function ClaimTypeTabs({ value, onChange, disabled }: ClaimTypeTabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((type) => {
        const isActive = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            disabled={disabled}
            // The inactive tab keeps `border-b-2 border-transparent` on purpose — giving the
            // border to the active tab only would change the button height by 2px on every
            // switch and make the tab bar jump. `-mb-px` hides the container border underneath.
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {CLAIM_TYPE_LABEL[type]}
          </button>
        );
      })}
    </div>
  );
}
