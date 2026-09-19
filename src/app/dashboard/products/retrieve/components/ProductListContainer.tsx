'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { SearchBar } from './SearchBar';
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
 * 로컬 state 는 항상 첫 페이지로 초기화된다.
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

  const [products, setProducts] = useState<Product[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new GetProductsUseCase(new ProductRepositoryImpl()),
    []
  );

  // 최신 조회 조건을 ref 로 읽어 `updateQuery` 를 안정된 함수로 유지한다. 조건이 바뀔 때마다
  // 새 함수가 되면 SearchBar 의 디바운스 이펙트가 페이지 이동 직후 다시 돌아 검색어만 담긴
  // patch 를 커밋하고, 그것이 "검색 변경"으로 보여 page 가 0 으로 되돌아간다(= 페이지 이동 불가).
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
    (keyword: string) => updateQuery({ search: keyword }),
    [updateQuery]
  );

  const handlePageChange = useCallback(
    (next: number) => updateQuery({ page: next }),
    [updateQuery]
  );

  return (
    <PageContainer
      title="상품 목록"
      action={<span className="text-gray-600">총 {totalElements}개</span>}
    >
      <SearchBar initialValue={search} onSearch={handleSearch} />
      <ProductTable
        products={products}
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
