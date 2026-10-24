'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import { MARKET_OPTION_LOCK_REASON, formatSitePrices } from './ListingDetailPanel';

/** Why a listing cannot be uploaded while its shipping settings are incomplete (77). The [마켓에 올리기] button and this window share it. */
export const SHIPPING_BLOCKED_REASON = '배송 설정 미완료 — 마스터/채널/계정 중 한 곳에서 배송 설정 필요';

export const UPLOAD_SUCCESS_MESSAGE =
  '마켓에 올렸습니다. 승인 결과는 ⋯ 메뉴의 [승인 새로고침]으로 확인하세요.';

interface ListingOptionPickerDialogProps {
  /** upload = the first upload (the [마켓에 올리기] confirm) · select = after the upload ([⋯ > 올릴 옵션 고르기]). */
  mode: 'upload' | 'select';
  listingId: number;
  /** 제목 꼬리표(`판매자 · 플랫폼[ · 상품ID]`). */
  channelLabel: string;
  /** Upload mode only: initial value of the display-name field (the listing's current name). */
  displayName?: string;
  /**
   * Upload mode only: called with the saved name after a successful display-name save.
   * The parent patches that cell's name in place. Do not call `load()` here — the loading
   * state unmounts the listing rows, which would also close this dialog (owned by CellActions).
   */
  onNameSaved?: (name: string) => void;
  /** [취소] · ✕ · ESC. 아무것도 저장하지 않는다. */
  onClose: () => void;
  /** 성공한 뒤. 부모가 창을 닫고 매트릭스를 다시 읽는다. */
  onDone: () => void;
}

/**
 * Option picker window — **the same shape for the first upload and after it** (FEATURE_2609_77, UX D43·D57).
 * File: src/app/dashboard/master-products/[id]/components/ListingOptionPickerDialog.tsx
 *
 * - upload: pick options, check the prices, [올리기] → (active options saved when the pick changed) → market
 *   register (Coupang · 11st · ESM, FEATURE_2610_13 / D9 ③ · FEATURE_2610_26 / D2).
 *   🔴 This window IS the confirmation for the market push (D29) — nothing is sent to the market before [올리기].
 * - select: [저장] → saves the active options only (no market call). An uploaded listing then needs [수정 요청].
 * - Upload mode display-name field: [저장] uses the same `updateDisplayName` path as
 *   `ListingDetailPanel` (empty value is not saved). While [저장] is enabled (unsaved edit) or
 *   saving, [올리기] is disabled; the saved name is what registration sends as `displayProductName`.
 *
 * ⚠️ Options, prices and market locks are read once with `getGenerated` on open (the same path in both modes).
 * ⚠️ An option on the market (`onMarket && active`) cannot be switched off — locked checkbox + 🔒 (87).
 * ⚠️ At least one option must be picked (the backend also answers 400).
 * ❌ Prices are not edited in this window — [⋯ > 가격 설정] does that.
 */
export function ListingOptionPickerDialog({
  mode,
  listingId,
  channelLabel,
  displayName = '',
  onClose,
  onDone,
  onNameSaved,
}: ListingOptionPickerDialogProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const [gen, setGen] = useState<GeneratedProductResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Display name (노출상품명) — upload mode only; same save path as ListingDetailPanel.
  const [nameDraft, setNameDraft] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const trimmedName = nameDraft.trim();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await useCase.getGenerated(listingId);
        if (!alive) return;
        setGen(res);
        setSelected(
          new Set(res.optionPrices.filter((p) => p.active !== false).map((p) => p.optionId)),
        );
      } catch (e: unknown) {
        if (alive) setLoadError(extractErrorMessage(e, '옵션을 불러오지 못했습니다.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId]);

  const prices = gen?.optionPrices ?? [];
  const currentActive = prices.filter((p) => p.active !== false).map((p) => p.optionId);
  const changed =
    selected.size !== currentActive.length || currentActive.some((id) => !selected.has(id));
  const shippingBlocked = mode === 'upload' && gen?.shippingReady === false;
  const hasLocked = prices.some((p) => p.onMarket === true && p.active !== false);
  // Upload is blocked while the display-name [저장] is enabled (unsaved edit) or saving —
  // registration sends the SAVED name, so an unsaved edit would silently not reach the market.
  const nameUnsaved = mode === 'upload' && !!trimmedName && trimmedName !== savedName;
  const canConfirm =
    gen !== null && !busy && selected.size > 0 && !shippingBlocked && !nameUnsaved && !savingName;

  const toggle = (optionId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const saveName = async () => {
    if (!trimmedName) return;
    setSavingName(true);
    setNameError('');
    try {
      await useCase.updateDisplayName(listingId, { name: trimmedName });
      setSavedName(trimmedName);
      onNameSaved?.(trimmedName);
    } catch {
      setNameError('노출상품명 저장에 실패했습니다.');
    } finally {
      setSavingName(false);
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (mode === 'select' && !changed) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      let needsResync = false;
      if (changed) {
        const res = await useCase.setActiveOptions(listingId, { activeOptionIds: [...selected] });
        needsResync = res.needsResync === true;
      }
      if (mode === 'upload') {
        await useCase.register(listingId);
        toast.success(UPLOAD_SUCCESS_MESSAGE);
      } else {
        toast.success(
          needsResync
            ? '올릴 옵션을 저장했습니다. 마켓에 반영하려면 [수정 요청]을 누르세요.'
            : '올릴 옵션을 저장했습니다.',
        );
      }
      onDone();
    } catch (e: unknown) {
      toast.error(
        extractErrorMessage(
          e,
          mode === 'upload' ? '마켓에 올리지 못했습니다.' : '올릴 옵션을 저장하지 못했습니다.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const title = `${mode === 'upload' ? '마켓에 올리기' : '올릴 옵션 고르기'} — ${channelLabel}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      disableClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={nameUnsaved ? '노출상품명을 먼저 저장하세요.' : undefined}
            isLoading={busy}
            loadingText={mode === 'upload' ? '올리는 중...' : '저장 중...'}
          >
            {mode === 'upload' ? '올리기' : '저장'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        <p>
          {mode === 'upload'
            ? '고른 옵션으로 마켓에 상품을 올립니다. 올린 뒤 승인 결과는 ⋯ 메뉴의 [승인 새로고침]으로 확인합니다.'
            : '마켓에 올릴 옵션을 고릅니다. 이미 마켓에 올린 판매상품은 저장한 뒤 [수정 요청]을 눌러야 마켓에 반영됩니다.'}
        </p>
        {mode === 'upload' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">노출상품명</span>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={savingName || busy}
              aria-label="노출상품명"
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={savingName || busy || !trimmedName || trimmedName === savedName}
              className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {savingName ? <Spinner size={12} label="저장 중" /> : '저장'}
            </button>
            {nameError && <span className="basis-full text-xs text-red-600">{nameError}</span>}
          </div>
        )}
        {gen === null ? (
          loadError ? (
            <p className="rounded bg-red-50 px-3 py-2 text-red-700">{loadError}</p>
          ) : (
            <Spinner size={14} label="옵션 불러오는 중" />
          )
        ) : prices.length === 0 ? (
          <p className="text-gray-400">옵션 없음</p>
        ) : (
          <DataCardSwitch
            placement="nested"
            renderCards={() =>
              // Narrow-screen cards (FEATURE_2610_31 D13 · D14): the app's option row — checkbox, name, price,
              // 🔒 on the right for an option already on the market.
              prices.map((p) => {
                const locked = p.onMarket === true && p.active !== false;
                const checked = selected.has(p.optionId);
                const tone = checked ? 'text-gray-900' : 'text-gray-500';
                return (
                  <DataCard
                    key={p.optionId}
                    selection={{
                      checked,
                      onChange: () => toggle(p.optionId),
                      label: `${p.optionName ?? `옵션 #${p.optionId}`} 선택`,
                      disabled: busy || locked,
                    }}
                    trailing={
                      locked ? (
                        <span className="text-[10px] text-gray-500" title={MARKET_OPTION_LOCK_REASON}>
                          🔒
                        </span>
                      ) : undefined
                    }
                    body={
                      <div className={`text-sm ${tone}`}>
                        <p>{p.optionName ?? `옵션 #${p.optionId}`}</p>
                        <p className="tabular-nums">{formatSitePrices(p.sellingPrice, p.auctionSellingPrice)}</p>
                      </div>
                    }
                  />
                );
              })
            }
          >
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-gray-200 bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="w-10 px-2 py-1.5" aria-label="올리기" />
                <th className="px-2 py-1.5 font-medium">옵션명</th>
                <th className="w-32 px-2 py-1.5 text-right font-medium">판매가</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => {
                const locked = p.onMarket === true && p.active !== false;
                const checked = selected.has(p.optionId);
                return (
                  <tr key={p.optionId} className="border-t border-gray-100">
                    <td className="px-2 py-1.5">
                      {/* 툴팁은 label 에 — disabled input 은 hover 이벤트를 쏘지 않는다. */}
                      <label
                        className="flex items-center gap-0.5"
                        title={locked ? MARKET_OPTION_LOCK_REASON : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || locked}
                          onChange={() => toggle(p.optionId)}
                        />
                        {locked && <span className="text-[10px] text-gray-400">🔒</span>}
                      </label>
                    </td>
                    <td className={`truncate px-2 py-1.5 ${checked ? 'text-gray-900' : 'text-gray-400'}`}>
                      {p.optionName ?? `옵션 #${p.optionId}`}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        checked ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {formatSitePrices(p.sellingPrice, p.auctionSellingPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </DataCardSwitch>
        )}
        {hasLocked && <p className="text-xs text-amber-700">{MARKET_OPTION_LOCK_REASON}</p>}
        {gen !== null && selected.size === 0 && (
          <p className="text-xs text-red-600">옵션을 1개 이상 고르세요.</p>
        )}
        {shippingBlocked && <p className="text-xs text-red-600">{SHIPPING_BLOCKED_REASON}</p>}
      </div>
    </Modal>
  );
}
