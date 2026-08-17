'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { ChannelFieldValuesModal } from './ChannelFieldValuesModal';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type {
  ListingStatus,
  ListingStatusResponse,
} from '@/domain/entities/ListingRegistrationEntity';

interface CellListing {
  id: number;
  status: ListingStatus;
}

interface CellActionsProps {
  listing: CellListing;
  options: MasterOptionResponse[];
  onReload: () => void;
}

type Busy = 'register' | 'fetch' | 'regenerate' | null;

/**
 * 등록됨/DRAFT 셀의 상태별 액션 버튼 (register / fetch-status / regenerate / 필드값 편집).
 * File: src/app/dashboard/master-products/[id]/components/CellActions.tsx
 *
 * 마켓 호출은 비동기(즉시 반환) — 승인은 이후 [승인 새로고침]으로 확인.
 */
export function CellActions({ listing, options, onReload }: CellActionsProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [statusResult, setStatusResult] = useState<ListingStatusResponse | null>(null);
  const [showFieldValues, setShowFieldValues] = useState(false);

  const optionName = (id: number) => options.find((o) => o.id === id)?.name ?? `옵션 #${id}`;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
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

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {status === 'DRAFT' && (
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy === 'register' ? <Spinner label="요청 중..." /> : '마켓 등록'}
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

        {(status === 'REJECTED' || status === 'SUSPENDED') && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{status}</span>
        )}

        <button
          type="button"
          onClick={() => setShowFieldValues(true)}
          disabled={busy !== null}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          필드값 편집
        </button>
      </div>

      {status === 'SUBMITTED' && !statusResult && (
        <p className="text-[11px] text-amber-600">승인 대기중</p>
      )}

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
    </div>
  );
}
