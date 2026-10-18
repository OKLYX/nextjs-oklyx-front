'use client';

import type { MouseEvent } from 'react';
import type { PurchaseShare } from '@/domain/entities/PurchaseListEntity';

/**
 * Share labels and the share action buttons — shared by the list table, the completed table and the share rows
 * inside an opened product (FEATURE_2610_09 D57 · D67 · D79 · D80 · D83).
 *
 * **File**: src/app/dashboard/purchase/list/components/purchaseShareUi.tsx
 * ⚠️ One place for the words and the buttons: the seller view draws them on the product row, 「전체」 draws them on
 *    each share row of the opened product (D83). Both read this file.
 * ❌ Do not write the state words (「매입 완료」 · 「필요 없음」 · 「필요 0」 · 「내일 매입」) anywhere else.
 */

/** Words drawn for a processed share. OPEN has none. */
export const SHARE_STATE_LABEL: Record<PurchaseShare['state'], string> = {
  OPEN: '',
  SKIPPED_TODAY: '내일 매입',
  PURCHASED: '매입 완료',
  NOT_NEEDED: '필요 없음',
  NEED_ZERO: '필요 0',
};

export type ShareCheckStatus = 'PURCHASED' | 'NOT_NEEDED' | 'TOMORROW';

/** What a share button asks the container to do. */
export interface ShareActions {
  onCheck: (productId: number, share: PurchaseShare, status: ShareCheckStatus) => void;
  onAskSkip: (productId: number, share: PurchaseShare) => void;
  onCancelCheck: (productId: number, share: PurchaseShare) => void;
  /** `${productId}-${sellerId}` of the share whose request is running; its buttons are disabled. */
  pendingKey: string | null;
}

export const shareKey = (productId: number, sellerId: number) => `${productId}-${sellerId}`;

const TAG_CLASS = 'ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 whitespace-nowrap';
const STATE_CLASS = 'px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 whitespace-nowrap';
const BUTTON_CLASS =
  'px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
const PRIMARY_BUTTON_CLASS =
  'px-2 py-0.5 text-xs border border-gray-300 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

/** 「목표 수량 매입 완료」 — shown on OPEN and SKIPPED_TODAY shares only (D57 ①). */
export function TargetMetTag({ share }: { share: PurchaseShare }) {
  if (!share.targetMet || (share.state !== 'OPEN' && share.state !== 'SKIPPED_TODAY')) return null;
  return <span className={TAG_CLASS}>목표 수량 매입 완료</span>;
}

/**
 * The words and buttons of one share, by state:
 * OPEN → [매입 완료] [오늘 매입 안 함] · SKIPPED_TODAY → 「내일 매입」 [되돌리기] · PURCHASED → 「매입 완료」 [완료 취소] ·
 * NOT_NEEDED → 「필요 없음」 [되돌리기] · NEED_ZERO → 「필요 0」.
 * Clicks stop here — the product row underneath toggles on click.
 */
export function ShareActionCell({
  productId,
  share,
  actions,
}: {
  productId: number;
  share: PurchaseShare;
  actions: ShareActions;
}) {
  const disabled = actions.pendingKey === shareKey(productId, share.sellerId);
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div className="flex items-center justify-end gap-1" onClick={stop}>
      {share.state === 'OPEN' && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => actions.onCheck(productId, share, 'PURCHASED')}
            className={PRIMARY_BUTTON_CLASS}
          >
            매입 완료
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => actions.onAskSkip(productId, share)}
            className={BUTTON_CLASS}
          >
            오늘 매입 안 함
          </button>
        </>
      )}
      {share.state !== 'OPEN' && <span className={STATE_CLASS}>{SHARE_STATE_LABEL[share.state]}</span>}
      {share.checkId != null && share.state !== 'NEED_ZERO' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => actions.onCancelCheck(productId, share)}
          className={BUTTON_CLASS}
        >
          {share.state === 'PURCHASED' ? '완료 취소' : '되돌리기'}
        </button>
      )}
    </div>
  );
}
