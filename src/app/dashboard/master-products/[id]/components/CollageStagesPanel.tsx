'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CollageUseCase } from '@/application/usecases/CollageUseCase';
import { CollageRepositoryImpl } from '@/infrastructure/repositories/CollageRepositoryImpl';
import type { CollageOverview } from '@/domain/entities/CollageEntity';
import { sourceLabel, stageKeyOf, stageLabel } from '../collage/components/collageLabels';

interface CollageStagesPanelProps {
  masterId: number;
}

/**
 * 「썸네일 콜라주」 block of the master 「이미지」 tab (FEATURE_2610_21 D40 master-tab entry · D41 · D42).
 * File: src/app/dashboard/master-products/[id]/components/CollageStagesPanel.tsx
 *
 * One row per stage — master default, each seller that has a listing of this master, each listing — with what the
 * stage currently uses and an [편집] button that opens the collage editor page at that stage. The block title comes from the
 * caller's `StackedBlock`; the caller renders it only for a master with 2+ components (`isCollageMaster`, D3).
 */
export function CollageStagesPanel({ masterId }: CollageStagesPanelProps) {
  const router = useRouter();
  const useCase = useMemo(() => new CollageUseCase(new CollageRepositoryImpl()), []);
  const [overview, setOverview] = useState<CollageOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.overview(masterId);
        if (alive) setOverview(res);
      } catch (e: unknown) {
        if (alive) setError(extractErrorMessage(e, '콜라주 상태를 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId]);

  return (
    <div className="space-y-2 p-4">
      <p className="text-[11px] text-gray-500">
        콜라주를 저장해도 썸네일은 바로 바뀌지 않습니다. 판매상품 상세 「썸네일」 탭의 [저장 후 재생성]으로
        반영됩니다.
      </p>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {isLoading ? (
        <div className="flex min-h-10 items-center">
          <Spinner size={18} label="불러오는 중..." />
        </div>
      ) : overview?.bundle ? (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {overview.stages.map((view) => (
            <li
              key={`${view.stage}-${view.sellerId ?? ''}-${view.listingId ?? ''}`}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                view.stage === 'LISTING' ? 'pl-8' : ''
              }`}
            >
              <span className={view.stage === 'LISTING' ? 'text-gray-700' : 'font-medium text-gray-900'}>
                {stageLabel(view)}
              </span>
              <span className="ml-auto text-xs text-gray-500">{sourceLabel(view)}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(ROUTES.MASTER_PRODUCT_COLLAGE(masterId, stageKeyOf(view)))}
              >
                편집
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
