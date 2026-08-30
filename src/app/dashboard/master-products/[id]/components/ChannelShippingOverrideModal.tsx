'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  configToOverride,
  diffOverride,
  mapToOverride,
  mergePreset,
  type OutboundPlace,
  type ReturnCenter,
  type ShippingConfig,
  type ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';

interface ChannelShippingOverrideModalProps {
  listingId: number;
  accountId: number;
  platform: string;
  channelLabel: string;
  initialOverride: Record<string, string> | null | undefined;
  shippingUseCase: ShippingUseCase; // parent-owned lookup; never created here
  listingUseCase: ListingRegistrationUseCase; // owns the save (PATCH shipping-override)
  onClose: () => void;
  onSaved: (updated: GeneratedProductResponse) => void;
}

/**
 * 채널(리스팅) 배송 override 편집 모달. 배송 필드가 10+개라 sub-row 대신 모달(74 chrome 재사용).
 * File: src/app/dashboard/master-products/[id]/components/ChannelShippingOverrideModal.tsx
 *
 * 오픈 시 그 채널 **계정**(accountId)으로 출고지/반품지를 조회(74 로직 재사용, 각 catch=조회 실패≠저장 차단).
 * ⚠️ **폼은 프리셋(판매자/마스터 상속 baseline)으로 채워서** 연다(mergePreset = 채널 override ?? baseline).
 * **저장 = 바뀐 필드만 채널 override** 로 저장(diffOverride, baseline 과 같은/비운 필드는 상속 유지, 사용자 결정 2026-08-28).
 * 저장 후 부모가 그 셀 shippingOverride 만 in-place 패치(전체 reload 최소화).
 *
 * [처음 설정으로 초기화] = 이 채널의 override 를 **전부**(출고지·반품지 포함) 삭제해 채널 생성 직후 상태로
 * 되돌린다(빈 맵 PATCH). 79 강제 적용이 place 키를 보존하는 것과 **의도적으로 다르다**(사용자 결정 2026-08-28).
 */
export function ChannelShippingOverrideModal({
  listingId,
  accountId,
  platform,
  channelLabel,
  initialOverride,
  shippingUseCase,
  listingUseCase,
  onClose,
  onSaved,
}: ChannelShippingOverrideModalProps) {
  const [override, setOverride] = useState<ShippingOverride>(() => mapToOverride(initialOverride));
  const [outbound, setOutbound] = useState<OutboundPlace[]>([]);
  const [returns, setReturns] = useState<ReturnCenter[]>([]);
  const [inherited, setInherited] = useState<ShippingConfig | null>(null);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const busy = isSaving || isResetting;
  // Nothing stored for this channel → resetting would be a no-op call.
  const hasOverride = !!initialOverride && Object.keys(initialOverride).length > 0;
  // Reset drops the place keys too, so the channel falls back to the account's places. Warn when the
  // account has none. inherited == null (both lookups failed) → say nothing rather than guess.
  const placesMissingAfterReset =
    inherited != null &&
    (inherited.outboundShippingPlaceCode == null || inherited.returnCenterCode == null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isResetting) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isSaving, isResetting, onClose]);

  // Fetch outbound/return for this channel's account + the inherited baseline used to pre-fill the
  // form (master ?? account). Prefer the backend-resolved baseline (getInheritedShipping); if that
  // fails, fall back to the account's own config (getConfig, the 72 endpoint the seller 배송관리 uses)
  // so the seller preset still fills in. Each catch degrades gracefully; async IIFE avoids
  // set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlacesLoading(true);
      const [outboundList, returnList, inheritedConfig, accountConfig] = await Promise.all([
        shippingUseCase.listOutbound(accountId).catch(() => [] as OutboundPlace[]),
        shippingUseCase.listReturn(accountId).catch(() => [] as ReturnCenter[]),
        listingUseCase.getInheritedShipping(listingId).catch(() => null),
        shippingUseCase.getConfig(accountId).catch(() => null),
      ]);
      if (cancelled) return;
      // master ?? account (resolved) if available, else the account preset as a resilient fallback.
      const baseline = inheritedConfig ?? accountConfig;
      setOutbound(outboundList);
      setReturns(returnList);
      setInherited(baseline);
      // Pre-fill the form with the preset baseline, the channel's own override winning per field.
      setOverride(mergePreset(mapToOverride(initialOverride), configToOverride(baseline)));
      setPlacesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shippingUseCase, listingUseCase, accountId, listingId, initialOverride]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      // Only fields the user changed from the preset baseline are persisted as this channel's override.
      const updated = await listingUseCase.updateShippingOverride(listingId, {
        override: diffOverride(override, configToOverride(inherited)),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, '배송 설정 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset = delete this channel's override entirely. The backend turns an empty map into null
  // (ShippingOverrideKeys.filterListing), so the channel is back to its just-created state and
  // follows 마스터 ?? 계정 again. Same post-save flow as handleSave (parent patches the cell in place).
  const handleReset = async () => {
    if (isResetting) return; // PopupDialogModal has no disabled prop — block re-entry here.
    try {
      setIsResetting(true);
      setError('');
      const updated = await listingUseCase.updateShippingOverride(listingId, { override: {} });
      onSaved(updated);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">배송 설정 — {channelLabel}</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
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

          <ShippingOverrideFields
            level="listing"
            value={override}
            onChange={setOverride}
            platform={platform}
            outbound={outbound}
            returns={returns}
            inherited={inherited ?? undefined}
            placesLoading={placesLoading}
            disabled={busy}
          />

          {/* Destructive action sits on its own line, left-aligned as a text button, so it never
              reads as a peer of [저장]. */}
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
        </div>
        </div>
      </div>

      <PopupDialogModal
        isOpen={isConfirmOpen}
        title="채널 배송 설정 초기화"
        message={
          <div className="space-y-3">
            <p>
              이 채널의 개별 배송 설정을 모두 지우고 처음 상태로 되돌립니다. 출고지·반품지 지정도 함께
              지워지며, 되돌릴 수 없습니다.
            </p>
            {placesMissingAfterReset && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                계정에 출고지/반품지가 지정돼 있지 않습니다. 초기화하면 이 채널의 출고지·반품지가 비어
                배송 설정 미완료가 되고 [마켓 등록]이 비활성화됩니다.
              </p>
            )}
          </div>
        }
        confirmText={isResetting ? '초기화 중...' : '초기화'}
        cancelText="취소"
        onConfirm={handleReset}
        onCancel={() => !isResetting && setIsConfirmOpen(false)}
        isDangerous
      />
    </>
  );
}
