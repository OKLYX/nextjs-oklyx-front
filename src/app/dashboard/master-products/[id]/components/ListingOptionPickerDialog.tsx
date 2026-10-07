'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import { MARKET_OPTION_LOCK_REASON, formatWon } from './ListingDetailPanel';

/** 배송 설정이 끝나지 않아 쿠팡에 올릴 수 없는 이유(77). [쿠팡에 올리기] 버튼과 이 창이 같은 문구를 쓴다. */
export const SHIPPING_BLOCKED_REASON = '배송 설정 미완료 — 마스터/채널/계정 중 한 곳에서 배송 설정 필요';

export const UPLOAD_SUCCESS_MESSAGE =
  '쿠팡에 올렸습니다. 승인 결과는 ⋯ 메뉴의 [승인 새로고침]으로 확인하세요.';

interface ListingOptionPickerDialogProps {
  /** upload = 처음 올릴 때([쿠팡에 올리기] 확인창) · select = 올린 뒤 [⋯ > 올릴 옵션 고르기]. */
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
 * 올릴 옵션 고르기 창 — **처음 올릴 때와 올린 뒤가 같은 모양**이다 (FEATURE_2609_77, UX D43·D57).
 * File: src/app/dashboard/master-products/[id]/components/ListingOptionPickerDialog.tsx
 *
 * - upload: 옵션을 고르고 판매가를 본 뒤 [올리기] → (고른 옵션이 바뀌었으면) 활성 옵션 저장 → 쿠팡 등록.
 *   🔴 이 창이 쿠팡 반영의 확인창이다(D29) — [올리기]를 누르기 전에는 쿠팡에 아무것도 보내지 않는다.
 * - select: [저장] → 활성 옵션만 저장(쿠팡 전송 없음). 이미 올린 판매상품이면 [수정 요청]이 필요하다.
 * - Upload mode display-name field: [저장] uses the same `updateDisplayName` path as
 *   `ListingDetailPanel` (empty value is not saved). It is independent of [올리기]; the saved
 *   name is what registration sends to Coupang as `displayProductName`.
 *
 * ⚠️ 옵션·판매가·마켓 잠금은 열 때 `getGenerated` 한 번으로 읽는다(두 모드 같은 경로).
 * ⚠️ 마켓에 올라간 옵션(`onMarket && active`)은 끌 수 없다 — 체크 잠금 + 🔒(87).
 * ⚠️ 최소 1개는 골라야 한다(백엔드도 400).
 * ❌ 판매가를 이 창에서 고치지 않는다 — [⋯ > 가격 설정]이 한다.
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
  const canConfirm = gen !== null && !busy && selected.size > 0 && !shippingBlocked;

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
            ? '올릴 옵션을 저장했습니다. 쿠팡에 반영하려면 [수정 요청]을 누르세요.'
            : '올릴 옵션을 저장했습니다.',
        );
      }
      onDone();
    } catch (e: unknown) {
      toast.error(
        extractErrorMessage(
          e,
          mode === 'upload' ? '쿠팡에 올리지 못했습니다.' : '올릴 옵션을 저장하지 못했습니다.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const title = `${mode === 'upload' ? '쿠팡에 올리기' : '올릴 옵션 고르기'} — ${channelLabel}`;

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
            ? '고른 옵션으로 쿠팡에 상품을 올립니다. 올린 뒤 승인 결과는 ⋯ 메뉴의 [승인 새로고침]으로 확인합니다.'
            : '쿠팡에 올릴 옵션을 고릅니다. 이미 쿠팡에 올린 판매상품은 저장한 뒤 [수정 요청]을 눌러야 쿠팡에 반영됩니다.'}
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
                      {formatWon(p.sellingPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
