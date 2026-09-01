'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { ChannelFieldValuesModal } from './ChannelFieldValuesModal';
import { ChannelShippingOverrideModal } from './ChannelShippingOverrideModal';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type {
  ListingStatus,
  ListingStatusResponse,
  GeneratedProductResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';

interface CellListing {
  id: number;
  status: ListingStatus;
}

interface CellActionsProps {
  masterId: number;
  listing: CellListing;
  options: MasterOptionResponse[];
  onReload: () => void;
  // Channel shipping override (75): the cell's account + current override for the modal.
  accountId: number;
  platform: string;
  channelLabel: string;
  shippingOverride: Record<string, string> | null | undefined;
  // Backend-resolved shipping readiness (77). false = [마켓 등록] 가드(비활성 + 사유).
  // null/undefined(미지원 플랫폼·레거시) = 가드 안 함 — 백엔드 400 이 최종 방어.
  shippingReady: boolean | null | undefined;
  shippingUseCase: ShippingUseCase; // parent-owned lookup (outbound/return)
  onShippingSaved: (updated: GeneratedProductResponse) => void;
}

type Busy = 'register' | 'fetch' | 'regenerate' | 'update' | null;

/**
 * 등록됨/DRAFT 셀의 상태별 액션 버튼 (register / update-request / fetch-status / regenerate / 필드값 편집).
 * File: src/app/dashboard/master-products/[id]/components/CellActions.tsx
 *
 * 마켓 호출은 비동기(즉시 반환) — 승인은 이후 [승인 새로고침]으로 확인.
 * [수정 요청](109): 등록된 셀(DRAFT 아님)의 현재 값을 마켓에 강제 재전송 → 재심사(SUBMITTED).
 */
export function CellActions({
  masterId,
  listing,
  options,
  onReload,
  accountId,
  platform,
  channelLabel,
  shippingOverride,
  shippingReady,
  shippingUseCase,
  onShippingSaved,
}: CellActionsProps) {
  const router = useRouter();
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [statusResult, setStatusResult] = useState<ListingStatusResponse | null>(null);
  // [수정 요청] success notice (109). Cleared whenever another action starts.
  const [pushedBanner, setPushedBanner] = useState('');
  const [showFieldValues, setShowFieldValues] = useState(false);
  const [showShipping, setShowShipping] = useState(false);

  const optionName = (id: number) => options.find((o) => o.id === id)?.name ?? `옵션 #${id}`;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setPushedBanner('');
    try {
      await fn();
    } catch {
      setError('요청에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const handleRegister = () =>
    run('register', async () => {
      await useCase.register(listing.id);
      onReload();
    });

  // Forced re-push of an already-registered cell (109). Not routed through run():
  // the backend's 400 message (미등록 / 비활성 계정 / 자동생성 먼저 / 활성 옵션 없음)
  // must surface as-is, and run() overwrites every failure with a fixed string.
  const handleUpdateRequest = async () => {
    if (!window.confirm('수정한 값을 마켓에 다시 보내고 재심사를 요청합니다. 계속하시겠습니까?')) return;
    setBusy('update');
    setError('');
    setPushedBanner('');
    try {
      await useCase.updateRequest(listing.id); // response unused: the reload is the source of truth
      setPushedBanner('승인 대기중으로 전환됨');
      setStatusResult(null); // the previous fetch-status result is stale now
      onReload();
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setError(msg ?? '수정 요청에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const handleFetch = () =>
    run('fetch', async () => {
      const res = await useCase.fetchStatus(listing.id);
      setStatusResult(res);
      onReload();
    });

  const handleRegenerate = () =>
    run('regenerate', async () => {
      await useCase.regenerate(listing.id);
      onReload();
    });

  // The matrix cell can't distinguish SUBMITTED/SELLING; the fetch-status result
  // (when present) is the source of truth and reveals the SELLING regenerate action.
  const status: ListingStatus = statusResult?.status ?? listing.status;

  // This channel has a stored shipping override → highlight the button.
  const hasShippingOverride = !!shippingOverride && Object.keys(shippingOverride).length > 0;

  // Guard the register action only (77). Strict false — undefined/null means "not judged" → allow.
  const shippingBlocked = shippingReady === false;
  const shippingBlockedReason = '배송 설정 미완료 — 마스터/채널/계정 중 한 곳에서 배송 설정 필요';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {status === 'DRAFT' && (
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy !== null || shippingBlocked}
            title={shippingBlocked ? shippingBlockedReason : undefined}
            className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy === 'register' ? <Spinner label="요청 중..." /> : '마켓 등록'}
          </button>
        )}

        {status !== 'DRAFT' && (
          <button
            type="button"
            onClick={handleUpdateRequest}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {busy === 'update' ? <Spinner label="요청 중..." /> : '수정 요청'}
          </button>
        )}

        {(status === 'SUBMITTED' || status === 'SELLING') && (
          <button
            type="button"
            onClick={handleFetch}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {busy === 'fetch' ? <Spinner label="확인 중..." /> : '승인 새로고침'}
          </button>
        )}

        {status === 'SELLING' && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {busy === 'regenerate' ? <Spinner label="재생성 중..." /> : '재생성'}
          </button>
        )}

        {status === 'REJECTED' && (
          <button
            type="button"
            onClick={handleFetch}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {busy === 'fetch' ? <Spinner label="확인 중..." /> : '승인 새로고침'}
          </button>
        )}

        {/* ⚠️ enum 원문을 노출하지 않는다(UI 용어 규칙). 반려는 막다른 길이 아니라 재확인이 가능해야 한다. */}
        {(status === 'REJECTED' || status === 'SUSPENDED') && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
            {status === 'REJECTED' ? '승인 반려' : '판매 중지'}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowFieldValues(true)}
          disabled={busy !== null}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          필드값 편집
        </button>

        <button
          type="button"
          onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL_EDIT(masterId, listing.id))}
          disabled={busy !== null}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          상세 편집
        </button>

        <button
          type="button"
          onClick={() => setShowShipping(true)}
          disabled={busy !== null}
          className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            hasShippingOverride
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          채널 배송 설정{hasShippingOverride ? ' ✓' : ''}
        </button>
      </div>

      {status === 'DRAFT' && shippingBlocked && (
        <p className="text-[11px] text-gray-500">{shippingBlockedReason}</p>
      )}

      {status === 'SUBMITTED' && !statusResult && (
        <p className="text-[11px] text-amber-600">승인 대기중</p>
      )}

      {pushedBanner && <p className="text-[11px] text-green-700">{pushedBanner}</p>}

      {statusResult && (
        <div className="space-y-1">
          {statusResult.status === 'SELLING' && (
            <p className="text-[11px] text-green-700">판매중으로 전환됨</p>
          )}
          <div className="flex flex-wrap gap-1">
            {statusResult.options.map((o) => (
              <span
                key={o.optionId}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  o.approvalStatus === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={o.platformOptionId ?? undefined}
              >
                {optionName(o.optionId)}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {showFieldValues && (
        <ChannelFieldValuesModal
          listingId={listing.id}
          onSaved={() => onReload()}
          onClose={() => setShowFieldValues(false)}
        />
      )}

      {showShipping && (
        <ChannelShippingOverrideModal
          listingId={listing.id}
          accountId={accountId}
          platform={platform}
          channelLabel={channelLabel}
          initialOverride={shippingOverride}
          shippingUseCase={shippingUseCase}
          listingUseCase={useCase}
          onSaved={onShippingSaved}
          onClose={() => setShowShipping(false)}
        />
      )}
    </div>
  );
}
