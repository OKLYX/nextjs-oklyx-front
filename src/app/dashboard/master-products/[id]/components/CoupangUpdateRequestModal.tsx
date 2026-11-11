'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type {
  ListingUpdateItemKey,
  ListingUpdateOptionLine,
  ListingUpdatePreview,
  ListingUpdatePreviewLine,
} from '@/domain/entities/ListingRegistrationEntity';
import { COUPANG_ONE_OPTION_NOTICE } from './ListingOptionPickerDialog';

interface CoupangUpdateRequestModalProps {
  listingId: number;
  onClose: () => void;
  /** Update request sent. The parent closes the window, shows the notice and reloads. */
  onDone: () => void;
}

const orNone = (v: string | null) => v ?? '(없음)';

/** Initial option checks: each line's `checked` · mixed bundle keeps only the first checked line (R10). */
const initialOptionChecks = (lines: ListingUpdateOptionLine[], mixedBundle: boolean): number[] => {
  const checked = lines.filter((l) => l.checked).map((l) => l.productListingOptionId);
  return mixedBundle && checked.length >= 2 ? checked.slice(0, 1) : checked;
};

/**
 * Coupang [수정 요청] comparison window (FEATURE_2611_25 / D3 · D10 · D11 · D12).
 * File: src/app/dashboard/master-products/[id]/components/CoupangUpdateRequestModal.tsx
 *
 * Lists the items whose current Coupang value differs from the oclyx value; the user picks which
 * items oclyx overwrites. Unchecked items are sent with the Coupang value as it is.
 *
 * - On open it reads the Coupang product once (`getUpdatePreview`). Not cached — every open starts
 *   from the initial checks again (D10).
 * - Renders the server's text (`label` · `coupangValue` · `oclyxValue` · `unavailableReason`) as is —
 *   never rebuilds or compares values here (R4).
 * - Always sends both fields: `overwrite` = checked selectable keys · `addOptions` = checked option lines.
 * - Coupang only. Other markets keep the plain confirm in `CellActions` (D12).
 */
export function CoupangUpdateRequestModal({ listingId, onClose, onDone }: CoupangUpdateRequestModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [preview, setPreview] = useState<ListingUpdatePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedKeys, setCheckedKeys] = useState<ListingUpdateItemKey[]>([]);
  const [checkedOptions, setCheckedOptions] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await useCase.getUpdatePreview(listingId);
        if (!alive) return;
        setPreview(res);
        setCheckedKeys(res.items.filter((i) => i.selectable).map((i) => i.key));
        setCheckedOptions(initialOptionChecks(res.optionLines, res.mixedBundle));
      } catch (e: unknown) {
        if (!alive) return;
        setError(extractErrorMessage(e, '쿠팡 상품을 읽지 못했습니다.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId]);

  const toggleKey = (key: ListingUpdateItemKey) =>
    setCheckedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // D30: in a mixed bundle, checking one option line unchecks the others.
  const toggleOption = (id: number) =>
    setCheckedOptions((prev) => {
      if (prev.includes(id)) return prev.filter((o) => o !== id);
      return preview?.mixedBundle ? [id] : [...prev, id];
    });

  const nothingToPick =
    preview != null &&
    preview.items.every((i) => !i.selectable) &&
    preview.optionLines.length === 0;
  const noOptionPicked = preview != null && preview.approvalPending && checkedOptions.length === 0;
  const sendDisabled = preview == null || saving || noOptionPicked;

  const handleSend = async () => {
    if (preview == null || sendDisabled) return;
    setSaving(true);
    setError('');
    try {
      await useCase.updateRequest(listingId, {
        overwrite: preview.items
          .filter((i) => i.selectable && checkedKeys.includes(i.key))
          .map((i) => i.key),
        addOptions: preview.optionLines
          .filter((l) => checkedOptions.includes(l.productListingOptionId))
          .map((l) => l.productListingOptionId),
      });
      onDone();
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '수정 요청에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = (item: ListingUpdatePreviewLine) => {
    const checked = item.selectable && checkedKeys.includes(item.key);
    return (
      <li key={item.key} className="px-3 py-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            disabled={!item.selectable || saving}
            checked={checked}
            onChange={() => toggleKey(item.key)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-900">
              {item.label}
              {!item.selectable && (
                <span className="ml-2 text-xs font-normal text-amber-700">oclyx 값 없음 — 쿠팡 값 유지</span>
              )}
            </span>
            {!item.selectable ? (
              <>
                {item.unavailableReason != null && (
                  <span className="block text-xs text-gray-500">{item.unavailableReason}</span>
                )}
                {item.coupangValue != null && (
                  <span className="block break-all text-xs text-gray-600">쿠팡 {item.coupangValue}</span>
                )}
              </>
            ) : item.options.length > 0 ? (
              item.options.map((o) => (
                <span key={o.productListingOptionId} className="mt-1 block text-xs">
                  <span className="block font-medium text-gray-800">{o.optionName}</span>
                  <span className="block break-all text-gray-600">쿠팡 {o.coupangValue}</span>
                  <span className="block break-all text-gray-900">oclyx {o.oclyxValue}</span>
                </span>
              ))
            ) : (
              <>
                <span className="block break-all text-xs text-gray-600">쿠팡 {orNone(item.coupangValue)}</span>
                <span className="block break-all text-xs text-gray-900">oclyx {orNone(item.oclyxValue)}</span>
              </>
            )}
          </span>
        </label>
      </li>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="수정 요청"
      disableClose={saving}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={sendDisabled}
            isLoading={saving}
            loadingText="보내는 중…"
          >
            {nothingToPick ? '그대로 다시 심사 요청' : '보내기'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">
        쿠팡 지금 값과 oclyx 값이 다른 항목입니다. 체크를 푼 항목은 쿠팡 값 그대로 보냅니다.
      </p>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 space-y-3">
        {loading ? (
          <Spinner size={14} label="쿠팡에서 읽는 중" />
        ) : (
          preview != null && (
            <>
              {nothingToPick && <p className="text-sm text-gray-500">쿠팡 값과 다른 항목이 없습니다</p>}

              {preview.items.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                  {preview.items.map(renderItem)}
                </ul>
              )}

              {preview.optionLines.length > 0 && (
                <div className="space-y-2">
                  {preview.mixedBundle && (
                    <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">{COUPANG_ONE_OPTION_NOTICE}</p>
                  )}
                  {preview.approvalPending && (
                    <p className="text-sm text-gray-700">승인 전 상품입니다 — 보낼 옵션을 고르세요.</p>
                  )}
                  <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                    {preview.optionLines.map((line) => (
                      <li key={line.productListingOptionId} className="px-3 py-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={saving}
                            checked={checkedOptions.includes(line.productListingOptionId)}
                            onChange={() => toggleOption(line.productListingOptionId)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-900" title={line.optionName}>
                            {preview.approvalPending ? line.optionName : `새 옵션 추가: ${line.optionName}`}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">보내면 쿠팡 재심사가 시작됩니다.</p>
    </Modal>
  );
}
