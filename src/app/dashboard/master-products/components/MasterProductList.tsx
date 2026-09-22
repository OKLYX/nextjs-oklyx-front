'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { Pagination } from '@/presentation/components/Pagination';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { detailHrefWithReturn } from '@/infrastructure/utils/listReturn';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import { parseQuery, toApiParams, toSearchParams, type MasterListQuery } from '../masterListQuery';
import { MasterProductSearchCard } from './MasterProductSearchCard';

/**
 * 판매상품 마스터 목록(서버 페이징·정렬·검색) + **생성** 모달 진입점 (83B / 111).
 * File: src/app/dashboard/master-products/components/MasterProductList.tsx
 *
 * ⚠️ 행 액션은 [삭제] 하나뿐이다 — 행 클릭이 상세로 이동하고 **수정은 전부 상세 페이지**에서 한다
 * (편집 지점 단일화). [상세]·[수정] 버튼을 다시 추가하지 말 것.
 * ⚠️ [삭제]는 **하드 삭제**다(2609_72) — 옵션·구성·사진·마켓 미등록 채널이 함께 사라진다.
 *    마켓에 올린 채널이 남아 있으면 서버가 409 로 막고, 그 문구를 그대로 배너에 띄운다.
 *
 * ⚠️ 조회 조건(page/size/sort/q)의 단일 진실원은 **URL** 이다(`useSearchParams` 파생). 같은 값을
 * `useState` 로 이중 보관하지 말 것. 변경은 `updateQuery` 하나로만 하고 `router.replace` 를 쓴다
 * (`push` 는 정렬 한 번 바꿀 때마다 뒤로가기 스택을 오염시킨다). 입력창의 `searchTerm` 은 **아직
 * 커밋되지 않은** 글자라 조회 조건이 아니다 — [검색] 을 눌러야 URL 로 넘어간다.
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

  // 입력 중인 검색어는 로컬 state, 커밋된 검색어는 URL(`q`) — 마운트 시 한 번만 URL 에서 가져온다.
  // URL→입력값 역동기화를 넣지 말 것(뒤로가기로 돌아왔을 때 입력이 튄다).
  const [searchTerm, setSearchTerm] = useState(q ?? '');

  const [masters, setMasters] = useState<MasterProductResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // 확인창 대상. null = 닫힘. busyId 는 기존 것(행 버튼 비활성)을 그대로 쓴다.
  const [deleteTarget, setDeleteTarget] = useState<MasterProductResponse | null>(null);


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

  const handleSearch = useCallback(() => {
    const next = searchTerm.trim();
    updateQuery({ q: next ? next : undefined });
  }, [searchTerm, updateQuery]);

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

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setError('');
    setBusyId(target.id);
    try {
      await useCase.remove(target.id);
      setDeleteTarget(null);
      // 마지막 항목을 지워 현재 페이지가 비면 이전 페이지로(로컬 state 가 아니라 URL 로 이동).
      if (masters.length === 1 && page > 0) {
        updateQuery({ page: page - 1 });
      } else {
        reloadCurrent();
      }
    } catch (e) {
      // 실패 이유는 배너가 말한다 — 창을 띄운 채 겹치지 않는다.
      setDeleteTarget(null);
      setError(extractErrorMessage(e, '삭제에 실패했습니다.'));
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
    <PageContainer title="판매상품 마스터">
      <MasterProductSearchCard
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearch}
        size={size}
        onSizeChange={(next) => updateQuery({ size: next })}
        sort={sort}
        onSortChange={(next) => updateQuery({ sort: next })}
        isLoading={isLoading}
        resultCount={totalElements}
      />

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
                <th className="px-4 py-3">구성상품</th>
                <th className="px-4 py-3">옵션</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {masters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    {q ? '검색 결과가 없습니다.' : '등록된 판매상품 마스터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                masters.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer border-b border-gray-100 text-sm text-gray-900 hover:bg-gray-50"
                    onClick={() =>
                      router.push(
                        detailHrefWithReturn(ROUTES.MASTER_PRODUCT_DETAIL(m.id), searchKey),
                      )
                    }
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
                    <td className="px-4 py-3">{m.components.length}</td>
                    <td className="px-4 py-3">{m.options.length}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
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

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="마스터 삭제"
        confirmText="삭제"
        isDangerous
        isLoading={busyId !== null && busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        message={
          <div className="space-y-2 text-left">
            <p>
              <span className="font-medium">{deleteTarget?.name}</span> 을(를) 삭제합니다.
              <span className="text-red-600"> 되돌릴 수 없습니다.</span>
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600">
              <li>
                옵션 {deleteTarget?.options.length}개 · 구성상품 {deleteTarget?.components.length}개와
                사진이 함께 삭제됩니다
              </li>
              <li>마켓에 올리지 않은 채널은 함께 삭제됩니다</li>
              <li>마켓에 올린 채널이 있으면 삭제되지 않습니다 — 먼저 [연결 해제] 하세요</li>
              <li>
                연결 해제한 판매상품이 이 마스터의 사진을 쓰고 있었다면 상세 이미지가 깨질 수 있습니다
              </li>
            </ul>
          </div>
        }
      />
    </PageContainer>
  );
}
