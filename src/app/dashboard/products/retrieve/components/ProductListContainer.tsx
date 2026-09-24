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
 * ⚠️ 조회 조건(page/q)은 **URL 이 원본**이다(`../productListQuery`). 상세로 갔다가 돌아오거나
 * 주소를 직접 열어도 같은 화면이 나와야 하므로, 마운트·URL 변경 때는 언제나 URL 값을 따른다.
 * (입력창의 `searchTerm` 은 **아직 커밋되지 않은** 글자라 조회 조건이 아니다 — [검색] 을 눌러야
 * 커밋된다.)
 *
 * 🔴 다만 **조회를 거는 값은 `applied`** 다. [검색]·페이지 이동은 URL 왕복을 기다리지 않고 그
 * 자리에서 `applied` 를 바꾼다. `router.replace` 는 비동기라(정적 페이지는 RSC 왕복이 따른다)
 * URL 이 바뀌기를 기다려 조회하면, 그 사이에 누른 [검색] 이 통째로 사라지거나 늦게 반영된다
 * (2026-09-24 사용자 보고 "재검색이 안 된다"). URL 이 뒤늦게 따라오면 값이 같으므로 재조회는
 * 일어나지 않는다.
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

  // 입력 중인 검색어는 로컬 state, 커밋된 검색어는 `applied.search` — 마운트 시 한 번만 URL 에서
  // 가져온다. URL→입력값 역동기화를 넣으면 뒤로가기로 돌아왔을 때 입력이 튄다.
  const [searchTerm, setSearchTerm] = useState(search);

  /**
   * 실제로 조회에 쓰는 조건. [검색]·페이지 이동이 즉시 바꾸고, URL 은 뒤따라 맞춰진다.
   *
   * 🔴 URL 이 바뀐 때(뒤로가기 · 상세에서 [← 목록] · 주소 직접 입력)는 URL 을 따른다 —
   * 아래 `urlKey` 블록이 **URL 이 바뀐 순간에만** 덮어쓴다. 매 렌더 덮어쓰면 방금 누른 [검색] 이
   * URL 이 따라오기 전에 되돌아간다.
   */
  const [applied, setApplied] = useState<ProductListQuery>({ page, search });
  const urlCondition = `${page}:${search}`;
  const [urlKey, setUrlKey] = useState(urlCondition);
  if (urlKey !== urlCondition) {
    setUrlKey(urlCondition);
    setApplied({ page, search });
  }

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
  const conditionKey = `${applied.page}:${applied.search}`;
  const [selectionKey, setSelectionKey] = useState(conditionKey);
  if (selectionKey !== conditionKey) {
    setSelectionKey(conditionKey);
    setSelectedIds([]);
  }

  // 최신 조회 조건을 ref 로 읽어 `updateQuery` 를 조건 변화와 무관한 안정된 함수로 유지한다.
  // 🔴 `setApplied` 직후에도 최신이어야 하므로 `updateQuery` 안에서 직접 갱신한다(이펙트는 URL·
  // 뒤로가기로 `applied` 가 바뀐 경우를 받아낸다).
  const queryRef = useRef<ProductListQuery>(applied);
  useEffect(() => {
    queryRef.current = applied;
  }, [applied]);

  /**
   * 조회 조건 갱신 단일 진입점(검색·페이지네이션 공용).
   * `patch` 에 `page` 키가 없으면 1페이지로 리셋한다(검색 변경) — 페이지 이동만 예외.
   *
   * 🔴 조건을 **먼저 `applied` 에 반영하고** URL 은 뒤에 맞춘다. `router.replace` 를 기다렸다가
   * 조회하면 URL 왕복이 늦거나 실패했을 때 [검색] 이 아무 일도 안 한 것처럼 보인다.
   * 🔴 조건이 지금과 같으면 `applied` 도 그대로여서 재조회 이펙트가 돌지 않는다. [검색] 은 언제나
   * 다시 불러오는 동작이어야 하므로 그때는 `reloadToken` 으로 재조회를 건다(상세를 보고
   * [← 목록] 으로 돌아오면 입력창에 직전 검색어가 채워져 있어, 그대로 [검색] 을 누르는 것이 흔한
   * 동선이다).
   */
  const updateQuery = useCallback(
    (patch: Partial<ProductListQuery>) => {
      const next: ProductListQuery = { ...queryRef.current, ...patch };
      if (!('page' in patch)) next.page = 0;
      const qs = toSearchParams(next).toString();
      // 키 순서에 흔들리지 않게 양쪽 모두 정규화한 쿼리스트링으로 비교한다.
      const unchanged = qs === toSearchParams(queryRef.current).toString();
      queryRef.current = next;
      setApplied(next);
      if (unchanged) setReloadToken((t) => t + 1);
      router.replace(qs ? `?${qs}` : ROUTES.PRODUCTS_RETRIEVE, { scroll: false });
    },
    [router]
  );

  // 상세에 실어 보낼 목록 조회 조건. 🔴 URL(`searchKey`) 이 아니라 `applied` 로 만든다 —
  // URL 이 아직 따라오지 않았어도 [← 목록] 은 **화면에 보이는 목록**으로 돌아와야 한다.
  const appliedQuery = useMemo(() => toSearchParams(applied).toString(), [applied]);

  useEffect(() => {
    let alive = true;
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await useCase.getProducts({
          page: applied.page,
          size: PAGE_SIZE,
          search: applied.search || undefined,
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
    // 🔴 `applied` 객체가 아니라 안의 값으로 건다 — URL 이 뒤늦게 같은 값으로 따라오며 객체만
    // 새로 만들어질 때 한 번 더 조회하지 않기 위해서다.
  }, [useCase, router, applied.page, applied.search, reloadToken]);

  // `term` 은 Enter 경로에서만 들어온다 — IME 조합 중 Enter 는 조합 확정 전이라 입력창의 값이
  // `searchTerm` state 보다 최신일 수 있다(`ProductSearchCard` 주석 참고). 버튼은 인자 없이 부른다.
  const handleSearch = useCallback(
    (term?: string) => updateQuery({ search: (term ?? searchTerm).trim() }),
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
        listQuery={appliedQuery}
        isLoading={isLoading}
        error={error}
        currentPage={applied.page}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
      />
      {totalPages > 1 && (
        <Pagination
          currentPage={applied.page}
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
