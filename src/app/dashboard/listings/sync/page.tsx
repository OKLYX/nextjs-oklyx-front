'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import type { PendingSyncResponse } from '@/domain/entities/ListingRegistrationEntity';
import { PendingSyncTable } from './components/PendingSyncTable';

interface Banner {
  text: string;
  tone: 'green' | 'amber';
}

/**
 * 마켓 반영/승인 콘솔.
 * File: src/app/dashboard/listings/sync/page.tsx
 *
 * 1) 미완료 승인 sweep = syncApprovals()
 * 2) 마켓 반영 대기(dirty) = pendingSync() 표 + 다중선택 push-sync
 * 자동 폴링 없음 — 모두 수동 트리거.
 */
export default function ListingsSyncPage() {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [rows, setRows] = useState<PendingSyncResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepBanner, setSweepBanner] = useState<Banner | null>(null);

  const [isPushing, setIsPushing] = useState(false);
  const [pushBanner, setPushBanner] = useState<Banner | null>(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await useCase.pendingSync();
      setRows(data);
      setSelected((prev) => prev.filter((id) => data.some((r) => r.productListingId === id)));
    } catch {
      setError('반영 대기 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [useCase]);

  useEffect(() => {
    void (async () => {
      await loadPending();
    })();
  }, [loadPending]);

  const handleSweep = async () => {
    setIsSweeping(true);
    setSweepBanner(null);
    try {
      const res = await useCase.syncApprovals();
      setSweepBanner({
        text: `훑음 ${res.swept} · 판매전환 ${res.promotedToSelling} · 대기 ${res.stillPending} · 실패 ${res.failed}${res.failed > 0 ? ' (일부 실패)' : ''}`,
        tone: res.failed > 0 ? 'amber' : 'green',
      });
    } catch {
      setSweepBanner({ text: '승인 일괄 확인에 실패했습니다.', tone: 'amber' });
    } finally {
      setIsSweeping(false);
    }
  };

  const toggle = (listingId: number) => {
    setSelected((prev) =>
      prev.includes(listingId) ? prev.filter((x) => x !== listingId) : [...prev, listingId],
    );
  };

  const handlePush = async () => {
    if (selected.length === 0) return;
    setIsPushing(true);
    setPushBanner(null);
    try {
      const res = await useCase.pushSync({ listingIds: selected });
      setPushBanner({
        text: `요청 ${res.requested} · 반영 ${res.pushed} · 건너뜀 ${res.skipped} · 실패 ${res.failed}${res.failed > 0 ? ' (일부 실패)' : ''}`,
        tone: res.failed > 0 ? 'amber' : 'green',
      });
      setSelected([]);
      await loadPending();
    } catch {
      setPushBanner({ text: '마켓 반영 요청에 실패했습니다.', tone: 'amber' });
    } finally {
      setIsPushing(false);
    }
  };

  const bannerClass = (tone: Banner['tone']) =>
    tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700';

  return (
    <PageContainer>
      <h1 className="text-xl font-semibold text-gray-900">마켓 반영/승인</h1>

      {/* Section 1: approval sweep */}
      <section className="rounded-lg bg-white p-4 shadow">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">미완료 승인 확인</h2>
            <p className="text-xs text-gray-500">
              등록 요청 후 승인은 이후 확인이 필요합니다. 자동 폴링은 없습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSweep}
            disabled={isSweeping}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSweeping ? <Spinner label="확인 중..." /> : '승인 일괄 확인'}
          </button>
        </div>
        {sweepBanner && (
          <p className={`rounded px-3 py-2 text-sm ${bannerClass(sweepBanner.tone)}`}>
            {sweepBanner.text}
          </p>
        )}
      </section>

      {/* Section 2: pending market-sync */}
      <section className="rounded-lg bg-white p-4 shadow">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">마켓 반영 대기</h2>
          <button
            type="button"
            onClick={handlePush}
            disabled={isPushing || selected.length === 0}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPushing ? <Spinner label="반영 중..." /> : `선택 항목 마켓 반영 (${selected.length})`}
          </button>
        </div>

        {pushBanner && (
          <p className={`mb-3 rounded px-3 py-2 text-sm ${bannerClass(pushBanner.tone)}`}>
            {pushBanner.text}
          </p>
        )}
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="list-table-scroll">
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner size={24} label="불러오는 중..." />
            </div>
          ) : (
            <PendingSyncTable rows={rows} selected={selected} onToggle={toggle} />
          )}
        </div>
      </section>
    </PageContainer>
  );
}
