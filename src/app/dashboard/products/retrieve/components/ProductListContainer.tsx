'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ProductSearchCard } from './ProductSearchCard';
import { ProductTable } from './ProductTable';
import { Pagination } from '@/presentation/components/Pagination';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';
import {
  PAGE_SIZE,
  parseQuery,
  toSearchParams,
  type ProductListQuery,
} from '../productListQuery';

/**
 * 상품 목록(상품조회) 컨테이너.
 *
 * ⚠️ 조회 조건(page/q)은 URL 이 단일 진실원이다(`../productListQuery`). 같은 값을 `useState` 로
 * 이중 보관하지 말 것 — 상세로 갔다가 뒤로가기로 돌아오면 컨테이너가 다시 마운트되므로
 * 로컬 state 는 항상 첫 페이지로 초기화된다. (입력창의 `searchTerm` 은 **아직 커밋되지 않은**
 * 글자라 조회 조건이 아니다 — [검색] 을 눌러야 URL 로 넘어간다.)
 *
 * ⚠️ 조건 변경은 `updateQuery` 하나로만 한다. `push` 가 아니라 `router.replace` 를 쓴다
 * (페이지를 넘길 때마다 뒤로가기 스택이 쌓이면 상세에서 한 번에 목록으로 못 돌아온다).
 */
export function ProductListContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 문자열로 memo — useSearchParams 객체 동일성에 기대면 리렌더마다 파생값이 새로 생긴다.
  const searchKey = searchParams.toString();
  const { page, search } = useMemo(() => parseQuery(new URLSearchParams(searchKey)), [searchKey]);

  // 입력 중인 검색어는 로컬 state, 커밋된 검색어는 URL(`search`) — 마운트 시 한 번만 URL 에서
  // 가져온다. URL→입력값 역동기화를 넣으면 뒤로가기로 돌아왔을 때 입력이 튄다.
  const [searchTerm, setSearchTerm] = useState(search);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new GetProductsUseCase(new ProductRepositoryImpl()),
    []
  );

  // 최신 조회 조건을 ref 로 읽어 `updateQuery` 를 page/search 변화와 무관한 안정된 함수로 유지한다.
  const queryRef = useRef<ProductListQuery>({ page, search });
  useEffect(() => {
    queryRef.current = { page, search };
  });

  /**
   * 조회 조건 갱신 단일 진입점(검색·페이지네이션 공용).
   * `patch` 에 `page` 키가 없으면 1페이지로 리셋한다(검색 변경) — 페이지 이동만 예외.
   */
  const updateQuery = useCallback(
    (patch: Partial<ProductListQuery>) => {
      const next: ProductListQuery = { ...queryRef.current, ...patch };
      if (!('page' in patch)) next.page = 0;
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `?${qs}` : ROUTES.PRODUCTS_RETRIEVE, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    let alive = true;
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await useCase.getProducts({
          page,
          size: PAGE_SIZE,
          search: search || undefined,
        });
        if (!alive) return;
        setProducts(response.content);
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
      } catch (err) {
        if (!alive) return;
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.removeToken();
          router.push(ROUTES.LOGIN);
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : '상품 목록을 불러오지 못했습니다';
        setError(errorMessage);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      alive = false;
    };
  }, [useCase, router, page, search]);

  const handleSearch = useCallback(
    () => updateQuery({ search: searchTerm.trim() }),
    [updateQuery, searchTerm]
  );

  const handlePageChange = useCallback(
    (next: number) => updateQuery({ page: next }),
    [updateQuery]
  );

  return (
    <PageContainer title="상품 목록">
      <ProductSearchCard
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearch}
        isLoading={isLoading}
        resultCount={totalElements}
      />
      <ProductTable
        products={products}
        listQuery={searchKey}
        isLoading={isLoading}
        error={error}
        currentPage={page}
        pageSize={PAGE_SIZE}
      />
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </PageContainer>
  );
}
