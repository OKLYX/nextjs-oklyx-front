'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { ElevenstShippingFields } from '@/presentation/components/ElevenstShippingFields';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { OutboundPlace, ReturnCenter } from '@/domain/entities/ShippingEntity';
import {
  diffElevenst,
  mergeElevenstPreset,
  pickElevenst,
  recalcFailureNote,
  tierError,
  type ElevenstShippingMap,
} from '@/domain/entities/ElevenstShipping';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import { Modal } from '@/presentation/components/ui/Modal';

interface ElevenstChannelShippingModalProps {
  listingId: number;
  accountId: number;
  channelLabel: string;
  initialOverride: Record<string, string> | null | undefined;
  shippingUseCase: ShippingUseCase; // parent-owned lookup; never created here
  listingUseCase: ListingRegistrationUseCase; // owns the save (PATCH shipping-override)
  onClose: () => void;
  onSaved: (updated: GeneratedProductResponse) => void;
}

/**
 * 11st listing shipping override (FEATURE_2610_13 / D85 · D104) — the 11st counterpart of
 * `ChannelShippingOverrideModal`, same flow: the form opens pre-filled with the inherited baseline
 * (master ?? 11st channel default, `GET …/elevenst-shipping-inherited`) and the listing's own values winning per key;
 * saving stores only the keys changed from that baseline; [처음 설정으로 초기화] saves an empty map.
 * D124: when a save or reset could not re-price this listing, a one-button notice comes first and closing it
 * closes this modal too.
 */
export function ElevenstChannelShippingModal({
  listingId,
  accountId,
  channelLabel,
  initialOverride,
  shippingUseCase,
  listingUseCase,
  onClose,
  onSaved,
}: ElevenstChannelShippingModalProps) {
  const [form, setForm] = useState<ElevenstShippingMap>(() => pickElevenst(initialOverride));
  const [inherited, setInherited] = useState<ElevenstShippingMap>({});
  const [outbound, setOutbound] = useState<OutboundPlace[]>([]);
  const [returns, setReturns] = useState<ReturnCenter[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [recalcNotice, setRecalcNotice] = useState<{ title: string; message: string } | null>(null);

  const busy = isSaving || isResetting;
  const hasOverride = !!initialOverride && Object.keys(initialOverride).length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [outboundList, returnList, baseline] = await Promise.all([
        shippingUseCase.listOutbound(accountId).catch(() => [] as OutboundPlace[]),
        shippingUseCase.listReturn(accountId).catch(() => [] as ReturnCenter[]),
        listingUseCase.getInheritedElevenstShipping(listingId).catch(() => ({}) as ElevenstShippingMap),
      ]);
      if (cancelled) return;
      setOutbound(outboundList);
      setReturns(returnList);
      setInherited(baseline);
      setForm(mergeElevenstPreset(pickElevenst(initialOverride), baseline));
      setPlacesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shippingUseCase, listingUseCase, accountId, listingId, initialOverride]);

  const handleSave = async () => {
    const tierMessage = tierError(form);
    if (tierMessage) {
      setError(tierMessage);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      const updated = await listingUseCase.updateShippingOverride(listingId, {
        override: diffElevenst(form, inherited),
      });
      onSaved(updated);
      const note = recalcFailureNote(updated.priceRecalcFailedCount);
      if (note) {
        setRecalcNotice({ title: '배송 설정 저장', message: note });
        return;
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, '배송 설정 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (isResetting) return;
    try {
      setIsResetting(true);
      setError('');
      const updated = await listingUseCase.updateShippingOverride(listingId, { override: {} });
      onSaved(updated);
      const note = recalcFailureNote(updated.priceRecalcFailedCount);
      if (note) {
        setIsConfirmOpen(false);
        setRecalcNotice({ title: '채널 배송 설정 초기화', message: note });
        return;
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, '배송 설정 초기화에 실패했습니다.'));
      setIsConfirmOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Modal isOpen onClose={onClose} title={`배송 설정 — ${channelLabel}`} disableClose={busy}>
        <p className="text-xs text-gray-500">
          판매자·마스터 배송 설정이 채워져 있습니다. 바꾼 값만 이 채널에 저장되고, 그대로 둔 값은 기본 설정을
          그대로 따릅니다.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <ElevenstShippingFields
          level="listing"
          value={form}
          onChange={setForm}
          outbound={outbound}
          returns={returns}
          inherited={inherited}
          placesLoading={placesLoading}
          disabled={busy}
        />

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={busy || !hasOverride}
            title={hasOverride ? undefined : '이 채널에는 개별 배송 설정이 없습니다.'}
            className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
          >
            처음 설정으로 초기화
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="채널 배송 설정 초기화"
        message={
          <p>
            이 채널의 개별 배송 설정을 모두 지우고 처음 상태로 되돌립니다. 출고지·반품지 지정도 함께 지워지며,
            되돌릴 수 없습니다.
          </p>
        }
        confirmText={isResetting ? '초기화 중...' : '초기화'}
        cancelText="취소"
        onConfirm={handleReset}
        onCancel={() => !isResetting && setIsConfirmOpen(false)}
        isDangerous
        nested
      />

      <ConfirmDialog
        isOpen={recalcNotice != null}
        title={recalcNotice?.title ?? ''}
        message={recalcNotice?.message ?? ''}
        onConfirm={onClose}
        nested
      />
    </>
  );
}
