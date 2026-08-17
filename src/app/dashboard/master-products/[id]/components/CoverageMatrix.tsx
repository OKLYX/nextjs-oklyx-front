'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { ListingMatrixResponse } from '@/domain/entities/MasterProductEntity';

interface CoverageMatrixProps {
  id: string;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 마스터 상세 = 커버리지 매트릭스(계정 × 리스팅).
 * File: src/app/dashboard/master-products/[id]/components/CoverageMatrix.tsx
 *
 * [채널 추가]/[일괄 반영]/[등록]/[수정·반영] 은 10번 프롬프트에서 구현되는 플레이스홀더(disabled).
 */
export function CoverageMatrix({ id }: CoverageMatrixProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);

  const [matrix, setMatrix] = useState<ListingMatrixResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await useCase.getMatrix(Number(id));
        if (alive) setMatrix(data);
      } catch {
        if (alive) setError('커버리지 매트릭스를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, id]);

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
              disabled
              title="10번 프롬프트에서 구현"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-400"
            >
              채널 추가
            </button>
            <button
              type="button"
              disabled
              title="10번 프롬프트에서 구현"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-400"
            >
              일괄 반영
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
                const status = !row.registered
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
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.cell?.sellingPrice != null ? formatWon(row.cell.sellingPrice) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled
                        title="10번 프롬프트에서 구현"
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-400"
                      >
                        {row.registered ? '수정/반영' : '등록'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
