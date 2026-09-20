'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ProductSearchCard } from './ProductSearchCard';
import { ProductTable } from './ProductTable';
import { BarcodeExtractResultModal } from './BarcodeExtractResultModal';
import { Button } from '@/presentation/components/ui/Button';
import { Pagination } from '@/presentation/components/Pagination';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { BarcodeExtractionUseCase } from '@/application/usecases/BarcodeExtractionUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { BarcodeExtractionRepositoryImpl } from '@/infrastructure/repositories/BarcodeExtractionRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';
import type { BarcodeExtractionResult } from '@/domain/entities/BarcodeExtraction';
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

  const barcodeUseCase = useMemo(
    () => new BarcodeExtractionUseCase(new BarcodeExtractionRepositoryImpl()),
    []
  );

  // 바코드 일괄 추출 (FEATURE_2609_65). ⚠️ 선택은 URL 에 넣지 않는다 — URL 이 소유하는 것은
  // 조회 조건뿐이다(위 주석).
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [extractResult, setExtractResult] = useState<BarcodeExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState('');

  // 🔴 페이지·검색어가 바뀌면 선택을 비운다. 안 비우면 화면에 보이지 않는 물품의 바코드를 건드린다.
  // 조회 조건이 바뀐 것을 렌더 중에 알아채 그 자리에서 버린다 — `useEffect` 로 비우면 한 번 더
  // 그린 뒤에 지워지므로, 그 사이에 [바코드 추출] 을 누르면 이전 페이지의 물품이 딸려 간다.
  const conditionKey = `${page}:${search}`;
  const [selectionKey, setSelectionKey] = useState(conditionKey);
  if (selectionKey !== conditionKey) {
    setSelectionKey(conditionKey);
    setSelectedIds([]);
  }

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
  }, [useCase, router, page, search, reloadToken]);

  const handleSearch = useCallback(
    () => updateQuery({ search: searchTerm.trim() }),
    [updateQuery, searchTerm]
  );

  const handlePageChange = useCallback(
    (next: number) => updateQuery({ page: next }),
    [updateQuery]
  );

  const handleToggle = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleToggleAll = useCallback(
    (checked: boolean) => setSelectedIds(checked ? products.map((p) => p.id) : []),
    [products]
  );

  /**
   * 선택한 물품의 사진에서 바코드를 읽어 빈 칸만 채운다.
   *
   * 🔴 일괄은 항상 `overwrite=false` 다(PLAN D7) — 20개를 한 번에 덮어쓰는 조작은 만들지 않는다.
   * 🔴 실패(예외)해도 재조회를 돌린다 — 프록시가 60초에 끊어도 서버는 계속 돌고 저장도 계속되므로
   * 이미 채워진 값이 있을 수 있다(PLAN D14).
   */
  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setExtractNotice('');
    try {
      const result = await barcodeUseCase.extract(selectedIds, false);
      setExtractResult(result);
      setSelectedIds([]);
      setReloadToken((t) => t + 1);
    } catch {
      setExtractResult(null);
      setExtractNotice('오래 걸려 결과를 받지 못했습니다. 목록의 바코드 열을 새로고침해 확인하세요');
      setReloadToken((t) => t + 1);
    } finally {
      setIsExtracting(false);
    }
  }, [barcodeUseCase, selectedIds]);

  return (
    <PageContainer title="상품 목록">
      <ProductSearchCard
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearch}
        isLoading={isLoading}
        resultCount={totalElements}
      />
      {/* 선택이 없으면 도구줄 자체를 그리지 않는다 — 빈 화면에 버튼이 떠 있으면 안 된다. */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 py-2">
          <span className="text-sm text-gray-700">{selectedIds.length}개 선택</span>
          <Button size="sm" onClick={handleExtract} disabled={isExtracting}>
            {isExtracting ? '추출 중… (사진을 여러 장 읽어 오래 걸릴 수 있습니다)' : '바코드 추출'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
            선택 해제
          </Button>
          {/* 🔴 이 안내를 빼지 말 것 — 큰 일괄이 프록시 타임아웃으로 끊기면 결과를 영영 못 본다. */}
          <span className="text-xs text-gray-500">
            5~10개씩 나눠 실행하는 것을 권합니다 (사진이 많으면 몇 분 걸립니다)
          </span>
        </div>
      )}
      {extractNotice && <p className="pb-2 text-sm text-gray-600">{extractNotice}</p>}
      <ProductTable
        products={products}
        listQuery={searchKey}
        isLoading={isLoading}
        error={error}
        currentPage={page}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
      />
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
      {extractResult && (
        <BarcodeExtractResultModal
          result={extractResult}
          onClose={() => setExtractResult(null)}
        />
      )}
    </PageContainer>
  );
}
