'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import type { ListingMatrixResponse, MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type { ListingStatus } from '@/domain/entities/ListingRegistrationEntity';
import { ChannelAddModal } from './ChannelAddModal';
import { MasterCategoryPanel } from './MasterCategoryPanel';
import { CellActions } from './CellActions';

interface CoverageMatrixProps {
  id: string;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 마스터 상세 = 커버리지 매트릭스(계정 × 리스팅) + 등록/전파 배선.
 * File: src/app/dashboard/master-products/[id]/components/CoverageMatrix.tsx
 */
export function CoverageMatrix({ id }: CoverageMatrixProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const masterId = Number(id);

  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);

  const [matrix, setMatrix] = useState<ListingMatrixResponse | null>(null);
  const [options, setOptions] = useState<MasterOptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Channel-add modal (optionally prefilled from an unregistered row)
  const [addPrefill, setAddPrefill] = useState<{ sellerId: number; platform: string } | undefined>();
  const [showAdd, setShowAdd] = useState(false);

  // Propagate (A-layer) summary banner
  const [isPropagating, setIsPropagating] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'green' | 'amber' } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [m, master] = await Promise.all([
        masterUseCase.getMatrix(masterId),
        masterUseCase.getById(masterId),
      ]);
      setMatrix(m);
      setOptions(master.options);
    } catch {
      setError('커버리지 매트릭스를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [masterUseCase, masterId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const openAdd = (prefill?: { sellerId: number; platform: string }) => {
    setAddPrefill(prefill);
    setShowAdd(true);
  };

  const handlePropagate = async () => {
    if (!window.confirm('마스터 변경분을 연결된 채널에 재생성합니다')) return;
    setIsPropagating(true);
    setBanner(null);
    try {
      const res = await listingUseCase.propagate(masterId);
      setBanner({
        text: `전파됨 ${res.propagated} · 건너뜀 ${res.skipped} · 실패 ${res.failed} — 마켓 반영은 반영/승인 콘솔에서 진행하세요.`,
        tone: res.failed > 0 ? 'amber' : 'green',
      });
      await load();
    } catch {
      setBanner({ text: '전파에 실패했습니다.', tone: 'amber' });
    } finally {
      setIsPropagating(false);
    }
  };

  // Matrix cell can't distinguish SUBMITTED/SELLING; map registered+platformProductId
  // to an initial status. CellActions upgrades it after a fetch-status refresh.
  const initialStatus = (platformProductId: string | null): ListingStatus =>
    platformProductId ? 'SUBMITTED' : 'DRAFT';

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.MASTER_PRODUCTS)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← 목록
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {matrix ? matrix.masterName : '커버리지 매트릭스'}
          </h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openAdd()}
              className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              채널 추가
            </button>
            <button
              type="button"
              onClick={handlePropagate}
              disabled={isPropagating}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isPropagating ? <Spinner label="반영 중..." /> : '일괄 반영'}
            </button>
          </div>
        )}
      </div>

      {banner && (
        <p
          className={`rounded px-3 py-2 text-sm ${
            banner.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {banner.text}
        </p>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isAdmin && (
        <MasterCategoryPanel
          masterId={masterId}
          useCase={masterUseCase}
          categoryUseCase={categoryUseCase}
        />
      )}

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            등록된 판매채널 계정이 없습니다.
          </p>
        ) : (
          <table>
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-4 py-3">판매자</th>
                <th className="px-4 py-3">플랫폼</th>
                <th className="px-4 py-3">계정</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">판매가</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => {
                const badge = !row.registered
                  ? '미등록'
                  : row.cell?.platformProductId
                    ? '등록됨'
                    : 'DRAFT';
                return (
                  <tr
                    key={row.accountId}
                    className="border-b border-gray-100 text-sm text-gray-900"
                  >
                    <td className="px-4 py-3">{row.sellerName}</td>
                    <td className="px-4 py-3">{row.platform}</td>
                    <td className="px-4 py-3">{row.accountLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          !row.registered
                            ? 'bg-gray-100 text-gray-500'
                            : row.cell?.platformProductId
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {badge}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.cell?.sellingPrice != null ? formatWon(row.cell.sellingPrice) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {!isAdmin ? (
                        <span className="text-xs text-gray-400">–</span>
                      ) : !row.registered || !row.cell ? (
                        <button
                          type="button"
                          onClick={() =>
                            openAdd({ sellerId: row.sellerId, platform: row.platform })
                          }
                          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          등록
                        </button>
                      ) : (
                        <CellActions
                          listing={{
                            id: row.cell.productListingId,
                            status: initialStatus(row.cell.platformProductId),
                          }}
                          options={options}
                          onReload={load}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <ChannelAddModal
          masterId={masterId}
          options={options}
          prefill={addPrefill}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
    </PageContainer>
  );
}
