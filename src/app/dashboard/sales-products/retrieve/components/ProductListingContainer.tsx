'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Pagination } from '@/presentation/components/Pagination';
import { ProductListingSearchCard } from './ProductListingSearchCard';
import { ProductListingTable } from './ProductListingTable';

/** 한 페이지 행 수. 서버에 보내는 size 와 화면 계산이 어긋나지 않도록 한 곳에서만 정한다. */
const PAGE_SIZE = 20;

export function ProductListingContainer() {
  const [searchPlatform, setSearchPlatform] = useState('');
  // 입력창의 값(타이핑 중) — 서버에 나간 검색어는 `appliedSearch` 다.
  const [searchTerm, setSearchTerm] = useState('');
  // 마지막으로 **조회에 쓴** 검색어. 페이지 이동·필터 토글이 이 값을 그대로 이어 써야
  // 2페이지로 넘어가는 순간 검색이 풀리는 일이 없다.
  const [appliedSearch, setAppliedSearch] = useState('');
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [expandedListingId, setExpandedListingId] = useState<number | null>(null);
  // 2609_22/D24: 마스터 미연결 셀만 보기(기본 false).
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  // 🔴 [검색] 버튼을 로딩 중에 잠그지 않으므로 요청이 겹칠 수 있다. 늦게 도착한 옛 응답이 새 결과를
  // 덮어쓰지 않도록 **마지막 요청만** 화면에 반영한다(물품 목록의 `alive` 가드와 같은 역할).
  const requestSeq = useRef(0);

  const productListingUseCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  // 서버를 치는 3경로(검색 · 페이지 이동 · refresh-flag 복원)를 한 함수로 모은다(파라미터 누락 방지).
  const fetchPage = useCallback(
    async (platform: string, page: number, onlyUnlinked: boolean, keyword: string) => {
      const seq = ++requestSeq.current;
      const isLatest = () => seq === requestSeq.current;
      try {
        setIsLoading(true);
        setError('');
        const result = await productListingUseCase.getByPlatform(
          platform,
          page,
          PAGE_SIZE,
          onlyUnlinked ? false : undefined, // masterLinked=false = 미연결만
          keyword,
        );
        if (!isLatest()) return; // 더 최신 요청이 이미 나갔다 — 이 응답은 버린다.
        setListings(result.content);
        setTotalPages(result.totalPages);
        setTotalElements(result.totalElements);
        setCurrentPage(page);
        setAppliedSearch(keyword);
        setHasSearched(true);
      } catch {
        if (!isLatest()) return;
        // 실패 시 목록을 비우는 것은 기존 handleSearch 동작 — 페이지 이동 실패에도 같게 적용한다.
        setError('판매상품 조회에 실패했습니다. 다시 시도해주세요.');
        setListings([]);
      } finally {
        if (isLatest()) setIsLoading(false);
      }
    },
    [productListingUseCase],
  );

  // 페이지 진입 시 검색 상태와 스크롤 위치 복원
  useEffect(() => {
    const restoreState = async () => {
      try {
        // 수정/삭제 후 돌아온 경우 이전 검색 재실행
        const refreshFlag = sessionStorage.getItem('refresh-product-listing');
        if (refreshFlag === 'true') {
          sessionStorage.removeItem('refresh-product-listing');

          // 저장된 검색 상태 확인
          const savedState = sessionStorage.getItem('sales-products-retrieve-state');
          if (savedState) {
            try {
              const state = JSON.parse(savedState);
              // 이전 플랫폼으로 자동 재검색
              if (state.searchPlatform) {
                setSearchPlatform(state.searchPlatform);
                const restoredUnlinked = state.unlinkedOnly ?? false;
                const restoredSearch = state.searchTerm ?? '';
                setUnlinkedOnly(restoredUnlinked);
                setSearchTerm(restoredSearch);

                // 비동기로 재검색 실행
                setTimeout(() => {
                  void fetchPage(state.searchPlatform, 0, restoredUnlinked, restoredSearch);
                }, 0);
              }
              sessionStorage.removeItem('sales-products-retrieve-state');
            } catch (err) {
              console.error('Failed to parse saved state:', err);
            }
          }
          return;
        }

        // 저장된 검색 상태 복원
        const savedState = sessionStorage.getItem('sales-products-retrieve-state');
        if (savedState) {
          const state = JSON.parse(savedState);
          setSearchPlatform(state.searchPlatform);
          setListings(state.listings);
          setHasSearched(state.hasSearched);
          setCurrentPage(state.currentPage);
          setTotalPages(state.totalPages);
          setTotalElements(state.totalElements ?? state.listings?.length ?? 0);
          setUnlinkedOnly(state.unlinkedOnly ?? false);
          setSearchTerm(state.searchTerm ?? '');
          setAppliedSearch(state.searchTerm ?? '');
          sessionStorage.removeItem('sales-products-retrieve-state');
        }
      } catch (err) {
        console.error('Failed to restore search state:', err);
      }

      // 스크롤 위치 복원
      const savedScrollPosition = sessionStorage.getItem('sales-products-retrieve-scroll');
      if (savedScrollPosition) {
        const scrollPos = parseInt(savedScrollPosition, 10);
        setTimeout(() => {
          window.scrollTo({ top: scrollPos, behavior: 'auto' });
        }, 100);
        sessionStorage.removeItem('sales-products-retrieve-scroll');
      }
    };

    // 페이지 로드 완료 후 상태 복원
    if (document.readyState === 'complete') {
      restoreState();
    } else {
      window.addEventListener('load', restoreState);
      return () => window.removeEventListener('load', restoreState);
    }
  }, [fetchPage]);

  /**
   * 🔴 `term` 은 **Enter 경로에서만** 넘어온다 — IME 조합 중 Enter 는 `searchTerm` 이 아직 한 글자
   * 뒤처져 있을 수 있어, 입력창에 보이는 값을 그대로 받아 쓴다.
   */
  const handleSearch = async (term?: string) => {
    const keyword = term ?? searchTerm;
    if (term !== undefined && term !== searchTerm) setSearchTerm(term);
    if (!searchPlatform) {
      setError('플랫폼을 선택해주세요.');
      return;
    }
    // 검색 조건이 바뀌었으므로 항상 첫 페이지부터 — 3페이지에서 검색하면 결과가 빈 화면이 된다.
    await fetchPage(searchPlatform, 0, unlinkedOnly, keyword);
  };

  const handlePageChange = async (page: number) => {
    await fetchPage(searchPlatform, page, unlinkedOnly, appliedSearch);
  };

  const handleUnlinkedOnlyChange = async (next: boolean) => {
    setUnlinkedOnly(next);
    // 플랫폼 미선택 상태면 상태만 바꾸고 재조회하지 않는다(에러도 띄우지 않는다).
    if (!searchPlatform) return;
    await fetchPage(searchPlatform, 0, next, appliedSearch);
  };

  const handleRowClick = async (id: number) => {
    if (expandedListingId === id) {
      setExpandedListingId(null);
    } else {
      setExpandedListingId(id);
      // 옵션 데이터 로드
      try {
        const options = await productListingUseCase.getOptions(id);
        setListings((prevListings) =>
          prevListings.map((listing) =>
            listing.id === id ? { ...listing, options } : listing
          )
        );
      } catch {
        console.error('옵션 조회에 실패했습니다.');
      }
    }
  };

  const handleSaveStateBeforeNavigation = () => {
    // 상태 저장 (detail page 이동 전)
    const state = {
      searchPlatform,
      searchTerm: appliedSearch,
      listings,
      hasSearched,
      currentPage,
      totalPages,
      totalElements,
      unlinkedOnly,
    };
    sessionStorage.setItem('sales-products-retrieve-state', JSON.stringify(state));
  };

  return (
    <PageContainer title="판매상품 조회">
      <ProductListingSearchCard
          searchPlatform={searchPlatform}
          onSearchChange={setSearchPlatform}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={totalElements}
          unlinkedOnly={unlinkedOnly}
          onUnlinkedOnlyChange={handleUnlinkedOnlyChange}
        />

        <ProductListingTable
          listings={listings}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          expandedListingId={expandedListingId}
          onRowClick={handleRowClick}
          onSaveState={handleSaveStateBeforeNavigation}
        />

        {/* 🔴 페이지 버튼을 여기서 새로 만들지 말 것 — 공통 `Pagination` 을 쓴다(그 파일의 금지 패턴).
            직접 만들었던 옛 UI 는 `totalPages` 만큼 번호 버튼을 **전부** 그려서, 페이지가 수십 개면
            줄이 화면 밖으로 넘치고 마지막 페이지로 한 번에 갈 수도 없었다. */}
        {hasSearched && listings.length > 0 && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

    </PageContainer>
  );
}
