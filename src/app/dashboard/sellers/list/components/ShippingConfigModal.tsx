'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';

const EMPTY_FORM: ShippingConfigRequest = {
  outboundShippingPlaceCode: null,
  returnCenterCode: null,
  returnChargeName: null,
  returnContactNumber: null,
  returnZipCode: null,
  returnAddress: null,
  returnAddressDetail: null,
  returnCharge: null,
  deliveryChargeOnReturn: null,
  deliveryMethod: null,
  deliveryCompanyCode: null,
  deliveryChargeType: null,
  deliveryCharge: null,
  freeShipOverAmount: null,
  remoteAreaDeliverable: null,
  unionDeliveryType: null,
  extraInfoMessage: null,
};

function toForm(c: ShippingConfig): ShippingConfigRequest {
  return {
    outboundShippingPlaceCode: c.outboundShippingPlaceCode,
    returnCenterCode: c.returnCenterCode,
    returnChargeName: c.returnChargeName,
    returnContactNumber: c.returnContactNumber,
    returnZipCode: c.returnZipCode,
    returnAddress: c.returnAddress,
    returnAddressDetail: c.returnAddressDetail,
    returnCharge: c.returnCharge,
    deliveryChargeOnReturn: c.deliveryChargeOnReturn,
    deliveryMethod: c.deliveryMethod,
    deliveryCompanyCode: c.deliveryCompanyCode,
    deliveryChargeType: c.deliveryChargeType,
    deliveryCharge: c.deliveryCharge,
    freeShipOverAmount: c.freeShipOverAmount,
    remoteAreaDeliverable: c.remoteAreaDeliverable,
    unionDeliveryType: c.unionDeliveryType,
    extraInfoMessage: c.extraInfoMessage,
  };
}

interface ShippingConfigModalProps {
  isOpen: boolean;
  account: MarketplaceAccount | null;
  onClose: () => void;
  useCase: ShippingUseCase; // parent-owned; never created inside this modal
}

/**
 * Shipping-management modal for one sales channel (MarketplaceAccount) = the
 * account default (base). Field editing is delegated to the shared
 * {@link ShippingOverrideFields} (level="account") so account / master / channel
 * all render the same fields. Lookup-first: outbound/return lists drive dropdowns;
 * a lookup failure never blocks saving (each fetch is caught independently).
 */
export function ShippingConfigModal({ isOpen, account, onClose, useCase }: ShippingConfigModalProps) {
  const [form, setForm] = useState<ShippingConfigRequest>(EMPTY_FORM);
  const [outbound, setOutbound] = useState<OutboundPlace[]>([]);
  const [returns, setReturns] = useState<ReturnCenter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isSaving, onClose]);

  // Open-load: fetch config + lookups in parallel. Each fetch is caught
  // independently — a lookup failure degrades to manual entry, not a blocker.
  useEffect(() => {
    if (!isOpen || !account) return;
    let cancelled = false;
    const accountId = account.id;
    (async () => {
      setIsLoading(true);
      setError('');
      const [config, outboundList, returnList] = await Promise.all([
        useCase.getConfig(accountId).catch(() => null),
        useCase.listOutbound(accountId).catch(() => [] as OutboundPlace[]),
        useCase.listReturn(accountId).catch(() => [] as ReturnCenter[]),
      ]);
      if (cancelled) return;
      setForm(config ? toForm(config) : EMPTY_FORM);
      setOutbound(outboundList);
      setReturns(returnList);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, account, useCase]);

  if (!isOpen || !account) {
    return null;
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      await useCase.upsertConfig(account.id, form);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, '배송설정 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            배송관리 — {account.accountAlias || account.platform}
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

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
            <ShippingOverrideFields
              level="account"
              value={form}
              onChange={setForm}
              platform={account.platform}
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
      </div>
    </div>
  );
}
