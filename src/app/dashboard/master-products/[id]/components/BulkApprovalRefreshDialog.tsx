'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { platformName } from '@/config/platforms';
import type {
  ListingStatus,
  MasterApprovalRefreshResponse,
  MasterApprovalRefreshResult,
} from '@/domain/entities/ListingRegistrationEntity';
import { STATUS_LABEL } from './ListingRow';

/** FEATURE_2610_38 / D3: the statuses whose row menu shows [승인 새로고침]. */
export const REFRESHABLE_STATUSES: ListingStatus[] = ['SUBMITTED', 'SELLING', 'REJECTED'];

/** FEATURE_2610_38 / D6: the markets the server can refresh (Coupang · 11st · ESM). */
export const REFRESHABLE_PLATFORMS = ['COUPANG', 'ELEVENST', 'ESM'];

/** FEATURE_2610_38 / D18: shown above the run button while a SELLING listing is checked. */
export const SELLING_PRICE_NOTICE =
  '판매중인 판매상품은 마켓에 올라가 있는 가격을 읽어 와 시스템 판매가를 그 가격으로 바꿉니다.';

/** One listing the window can pick. `label` = `{seller name}/{market name} — {status screen text}` (D16). */
export interface BulkRefreshCandidate {
  productListingId: number;
  label: string;
  status: ListingStatus;
}

/** FEATURE_2610_38 / D5: the summary line of the result box. */
export const bulkRefreshSummaryText = (res: MasterApprovalRefreshResponse): string =>
  `대상 ${res.requested} · 새로고침 ${res.refreshed} · 건너뜀 ${res.skipped} · 실패 ${res.failed}`;

/** FEATURE_2610_38 / D5: one picked listing's line of the result box. */
export const bulkRefreshResultLine = (sellerName: string, r: MasterApprovalRefreshResult): string => {
  const head = `${sellerName}/${platformName(r.platform)}`;
  if (r.outcome !== 'REFRESHED' || r.status == null) return `${head} — ${r.message ?? ''}`;
  return `${head} — ${STATUS_LABEL[r.status]}${r.reviewNote ? ` · 심사 사유: ${r.reviewNote}` : ''}`;
};

interface BulkApprovalRefreshDialogProps {
  /** The listings that can be picked, in table order (D19). */
  candidates: BulkRefreshCandidate[];
  /** ✕ · ESC · [취소] — nothing is called (D12). */
  onClose: () => void;
  /** [새로고침 (n)] — the picked ids in table order. The parent closes this window and calls the server. */
  onConfirm: (listingIds: number[]) => void;
}

/**
 * The 「전체 승인 새로고침」 picking window of the master detail (FEATURE_2610_38 / D12 · D16 · D17 · D18).
 * File: src/app/dashboard/master-products/[id]/components/BulkApprovalRefreshDialog.tsx
 *
 * - Mount it only while open: the picks start over on every open — SUBMITTED · REJECTED checked, SELLING unchecked
 *   (D17). Nothing is remembered between opens.
 * - 「전체 선택」 checks or clears every line, SELLING included (D17).
 * - The price notice sits right above the run button while a SELLING line is checked (D18).
 *
 * ❌ No server call here — the parent's head button shows 「새로고침 중...」 while it runs (D12).
 * Mobile twin: `lib/features/master_product/presentation/widgets/bulk_approval_refresh_sheet.dart`.
 */
export function BulkApprovalRefreshDialog({ candidates, onClose, onConfirm }: BulkApprovalRefreshDialogProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(candidates.filter((c) => c.status !== 'SELLING').map((c) => c.productListingId)),
  );
  const picked = candidates.filter((c) => checked.has(c.productListingId));
  const allChecked = candidates.length > 0 && picked.length === candidates.length;
  const sellingPicked = picked.some((c) => c.status === 'SELLING');

  const toggle = (listingId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(candidates.map((c) => c.productListingId)));
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="전체 승인 새로고침"
      footer={
        <div className="flex w-full flex-col items-end gap-2">
          {sellingPicked && <p className="text-xs text-amber-700">{SELLING_PRICE_NOTICE}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              onClick={() => onConfirm(picked.map((c) => c.productListingId))}
              disabled={picked.length === 0}
            >
              {`새로고침 (${picked.length})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2 border-b border-gray-200 pb-2 font-medium">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          전체 선택
        </label>
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.productListingId}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked.has(c.productListingId)}
                  onChange={() => toggle(c.productListingId)}
                />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
