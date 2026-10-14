'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { ElevenstShippingFields } from '@/presentation/components/ElevenstShippingFields';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { OutboundPlace, ReturnCenter } from '@/domain/entities/ShippingEntity';
import {
  cleanElevenstMap,
  recalcFailureNote,
  tierError,
  type ElevenstShippingMap,
} from '@/domain/entities/ElevenstShipping';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { Modal } from '@/presentation/components/ui/Modal';

interface ElevenstShippingConfigModalProps {
  account: MarketplaceAccount;
  onClose: () => void;
  useCase: ShippingUseCase; // parent-owned; never created inside this modal
}

/**
 * 11st channel default shipping settings (FEATURE_2610_13 / D84) — the 11st branch of {@link ShippingConfigModal}.
 * Loads the stored settings and the 11st address lists (1014 · 1015) in parallel; a failed list read degrades to
 * an empty list and never blocks saving. Saving replaces the whole map (`PUT …/elevenst-shipping-config`).
 * D124: when the save could not re-price some 11st listings, a one-button notice comes first and closing it
 * closes this modal too.
 */
export function ElevenstShippingConfigModal({ account, onClose, useCase }: ElevenstShippingConfigModalProps) {
  const [form, setForm] = useState<ElevenstShippingMap>({});
  const [outbound, setOutbound] = useState<OutboundPlace[]>([]);
  const [returns, setReturns] = useState<ReturnCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [recalcNotice, setRecalcNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    const accountId = account.id;
    (async () => {
      const [config, outboundList, returnList] = await Promise.all([
        useCase.getElevenstConfig(accountId).catch(() => null),
        useCase.listOutbound(accountId).catch(() => [] as OutboundPlace[]),
        useCase.listReturn(accountId).catch(() => [] as ReturnCenter[]),
      ]);
      if (cancelled) return;
      setForm(config?.settings ?? {});
      setOutbound(outboundList);
      setReturns(returnList);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [account, useCase]);

  const handleSave = async () => {
    const tierMessage = tierError(form);
    if (tierMessage) {
      setError(tierMessage);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      const saved = await useCase.upsertElevenstConfig(account.id, cleanElevenstMap(form));
      const note = recalcFailureNote(saved.priceRecalcFailedCount);
      if (note) {
        setRecalcNotice(note);
        return;
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, '배송설정 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={`배송관리 — ${account.accountAlias || '11번가'}`}
        disableClose={isSaving}
      >
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
            <ElevenstShippingFields
              level="account"
              value={form}
              onChange={setForm}
              outbound={outbound}
              returns={returns}
              disabled={isSaving}
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <Spinner label="저장 중..." /> : '저장'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!recalcNotice}
        title="배송 설정 저장"
        message={recalcNotice}
        onConfirm={onClose}
        nested
      />
    </>
  );
}
