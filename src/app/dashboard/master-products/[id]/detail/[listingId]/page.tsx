'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { DetailTemplateResponse } from '@/domain/entities/DetailTemplateEntity';
import { DetailEditorTabs } from './components/DetailEditorTabs';

/**
 * 상세페이지 3층 블록 에디터 (채널 셀별). prompt 11.
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/page.tsx
 *
 * 페이지가 `generated`(단일 소스)와 선택된 단일 `template`을 소유하고, 자식 탭은
 * 갱신을 `onGenerated(res)` 콜백으로 위로 올린다(props down / events up).
 * source 는 별도 state 없이 항상 `generated.source`로 파생.
 */
export default function MasterProductDetailEditPage() {
  const params = useParams<{ id: string; listingId: string }>();
  const router = useRouter();
  const masterId = Number(params.id);
  const listingId = Number(params.listingId);

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const detailUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );
  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );

  const [generated, setGenerated] = useState<GeneratedProductResponse | null>(null);
  const [template, setTemplate] = useState<DetailTemplateResponse | null>(null);
  const [masterName, setMasterName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [gen, resolvedTemplate, master] = await Promise.all([
          listingUseCase.getGenerated(listingId),
          listingUseCase.getResolvedDetailTemplate(listingId),
          masterUseCase.getById(masterId),
        ]);
        if (!alive) return;
        setGenerated(gen);
        setTemplate(resolvedTemplate);
        setMasterName(master.name);
      } catch {
        if (alive) setError('상세 편집 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingUseCase, detailUseCase, masterUseCase, masterId, listingId, isAdmin]);

  if (!isAdmin) {
    return (
      <PageContainer>
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">권한이 없습니다.</p>
      </PageContainer>
    );
  }

  const source = generated?.source ?? null;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(masterId))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← 매트릭스
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {masterName || '상세 편집'}
            </h1>
            <p className="text-xs text-gray-500">채널 리스팅 #{listingId} 상세페이지</p>
          </div>
        </div>
        {source && (
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${
              source === 'MANUAL_OVERRIDE'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {source === 'MANUAL_OVERRIDE' ? '수동 수정됨' : '자동생성'}
          </span>
        )}
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : generated && template ? (
        <DetailEditorTabs
          masterId={masterId}
          listingId={listingId}
          generated={generated}
          template={template}
          listingUseCase={listingUseCase}
          detailUseCase={detailUseCase}
          onGenerated={setGenerated}
        />
      ) : (
        !error && <p className="text-sm text-gray-500">표시할 상세 데이터가 없습니다.</p>
      )}
    </PageContainer>
  );
}
