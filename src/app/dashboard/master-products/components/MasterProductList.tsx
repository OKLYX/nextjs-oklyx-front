'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { Pagination } from '@/presentation/components/Pagination';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import { parseQuery, toApiParams, toSearchParams, type MasterListQuery } from '../masterListQuery';
import { MasterProductToolbar } from './MasterProductToolbar';

/**
 * 판매상품 마스터 목록(서버 페이징·정렬·검색) + **생성** 모달 진입점 (83B / 111).
 * File: src/app/dashboard/master-products/components/MasterProductList.tsx
 *
 * ⚠️ 행 액션은 [삭제] 하나뿐이다 — 행 클릭이 상세로 이동하고 **수정은 전부 상세 페이지**에서 한다
 * (편집 지점 단일화). [상세]·[수정] 버튼을 다시 추가하지 말 것.
 *
 * ⚠️ 조회 조건(page/size/sort/q)의 단일 진실원은 **URL** 이다(`useSearchParams` 파생). 같은 값을
 * `useState` 로 이중 보관하지 말 것. 변경은 `updateQuery` 하나로만 하고 `router.replace` 를 쓴다
 * (`push` 는 정렬 한 번 바꿀 때마다 뒤로가기 스택을 오염시킨다).
 *
 * ⚠️ 같은 URL 로 replace 하면 파생값이 그대로라 재조회 이펙트가 돌지 않는다 → URL 이 안 바뀌어도
 * 재조회해야 하는 경로(삭제 후, 기본 상태에서의 생성)는 `reloadTick` 을 올려 강제한다.
 */
export function MasterProductList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  // 목록은 마스터 유즈케이스 하나만 쓴다. 생성 폼이 쓰던 나머지 7개는 생성 페이지가 소유한다
  // (`master-products/new/components/MasterProductCreateContainer.tsx`).
  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);

  // URL 문자열로 memo — useSearchParams 객체 동일성에 기대면 부모 리렌더마다 파생값이 새로 생긴다.
  const searchKey = searchParams.toString();
  const query = useMemo(() => parseQuery(new URLSearchParams(searchKey)), [searchKey]);
  const { page, size, sort, q } = query;

  const [masters, setMasters] = useState<MasterProductResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);


  /**
   * 조회 조건 갱신 단일 진입점(툴바·페이지네이션 공용).
   * `patch` 에 `page` 키가 없으면 1페이지로 리셋한다(검색·정렬·크기 변경) — 페이지 이동만 예외.
   */
  const updateQuery = useCallback(
    (patch: Partial<MasterListQuery>) => {
      const next: MasterListQuery = { ...query, ...patch };
      if (!('page' in patch)) next.page = 0;
      router.replace(`?${toSearchParams(next).toString()}`, { scroll: false });
    },
    [query, router],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.list(toApiParams({ page, size, sort, q }));
        if (!alive) return;
        // 범위 초과 페이지(?page=99 직접 진입, 조건 변경으로 총 페이지 감소)는 마지막 페이지로 1회 보정.
        // URL 이 실제로 바뀌므로 이 이펙트가 다시 돌고, 보정 후엔 조건이 자연 해제된다(가드 불필요).
        if (res.totalPages > 0 && page >= res.totalPages) {
          updateQuery({ page: res.totalPages - 1 });
          return;
        }
        setMasters(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
      } catch {
        if (alive) setError('판매상품 마스터를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, isAdmin, page, size, sort, q, reloadTick, updateQuery]);

  /** 삭제 후: URL 은 그대로 두고 현재 페이지만 재조회. */
  const reloadCurrent = useCallback(() => setReloadTick((tick) => tick + 1), []);

  const handleDelete = async (m: MasterProductResponse) => {
    if (!confirm(`마스터 "${m.name}" 을(를) 삭제하시겠습니까?`)) return;
    setError('');
    setBusyId(m.id);
    try {
      await useCase.remove(m.id);
      // 마지막 항목을 지워 현재 페이지가 비면 이전 페이지로(로컬 state 가 아니라 URL 로 이동).
      if (masters.length === 1 && page > 0) {
        updateQuery({ page: page - 1 });
      } else {
        reloadCurrent();
      }
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <p className="text-sm text-gray-500">접근 권한이 없습니다.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="판매상품 마스터"
      action={<span className="text-sm text-gray-600">총 {totalElements}개</span>}
    >
      <MasterProductToolbar query={query} onChange={updateQuery} />

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : (
          <table>
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3">사진</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">구성상품</th>
                <th className="px-4 py-3">옵션</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {masters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    {q ? '검색 결과가 없습니다.' : '등록된 판매상품 마스터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                masters.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer border-b border-gray-100 text-sm text-gray-900 hover:bg-gray-50"
                    onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(m.id))}
                  >
                    <td className="px-4 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded bg-gray-100">
                        {m.sourceImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveThumbUrl(m.sourceImageUrl)}
                            alt={m.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                            없음
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{m.components.length}</td>
                    <td className="px-4 py-3">{m.options.length}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          disabled={busyId === m.id}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(next) => updateQuery({ page: next })}
        />
      )}
    </PageContainer>
  );
}
