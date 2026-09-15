'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ClaimRepositoryImpl } from '@/infrastructure/repositories/ClaimRepositoryImpl';
import { ClaimUseCase } from '@/application/usecases/ClaimUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import {
  CLAIM_TYPE_LABEL,
  EXCHANGE_STATUS_FILTERS,
  RETURN_STATUS_FILTERS,
} from '@/domain/entities/ClaimEntity';
import type { Claim, ClaimStatus, ClaimType } from '@/domain/entities/ClaimEntity';
import { RECENT_PERIOD, buildPeriodOptions, toPeriodRange } from '@/domain/entities/OrderPeriod';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import { ClaimSearchCard } from './ClaimSearchCard';
import { ClaimTypeTabs } from './ClaimTypeTabs';
import { ClaimStatusFilter } from './ClaimStatusFilter';
import { ClaimTable } from './ClaimTable';
import { ClaimDetailsModal } from './ClaimDetailsModal';

const PAGE_SIZE = 20;

// Status chip selected on entry and after a tab switch. 접수 is what needs handling first, so it
// is the landing filter instead of 전체. Must stay a value present in BOTH
// RETURN_STATUS_FILTERS and EXCHANGE_STATUS_FILTERS.
const DEFAULT_STATUS: ClaimStatus = 'RECEIVED';

export function ClaimContainer() {
  const router = useRouter();
  // 알림(종)에서 들어온 클레임 딥링크(PLAN 2609_51 D9). 클레임은 전용 상세 페이지가 없어(모달)
  // 쿼리 파라미터로 모달을 연다.
  const searchParams = useSearchParams();
  const deepLinkClaimId = searchParams.get('claimId');
  const deepLinkType = searchParams.get('type');

  const claimUseCase = useMemo(() => new ClaimUseCase(new ClaimRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  // Defaults to 접수 (see DEFAULT_STATUS); null still means 전체.
  const [selectedStatus, setSelectedStatus] = useState<ClaimStatus | null>(DEFAULT_STATUS);
  // Picked in the dropdown but only applied to the list on [조회].
  const [selectedPeriod, setSelectedPeriod] = useState<string>(RECENT_PERIOD);
  const [searchTerm, setSearchTerm] = useState('');
  // 접수일 single axis — there is no sort key state.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  // The tab is a server axis: switching it refetches.
  // 🔴 딥링크 타입은 탭에도 반영한다 — 조회만 바꾸면 탭 라벨은 `반품` 인데 내용은 교환이 된다.
  //    파라미터가 없으면 기본값은 그대로 `'RETURN'`.
  const initialClaimType: ClaimType = deepLinkType === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN';
  const [claimType, setClaimType] = useState<ClaimType>(initialClaimType);
  // 최초 조회에만 쓰는 값 — URL 이 정리돼도(모달 닫기) 재조회가 돌지 않게 ref 로 고정한다.
  const initialClaimTypeRef = useRef<ClaimType>(initialClaimType);

  // null = do not label months with data — claims have no "months with data" API.
  const periodOptions = useMemo(() => buildPeriodOptions(null), []);

  const fetchClaims = useCallback(
    async (type: ClaimType, sellerId: number | '', period: string, keyword: string) => {
      try {
        setIsLoading(true);
        setError('');
        const result = await claimUseCase.getClaims({
          type,
          ...(sellerId !== '' ? { sellerId } : {}),
          ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
          period: toPeriodRange(period),
        });
        setClaims(result);
        setHasSearched(true);
        setCurrentPage(0);
      } catch (err) {
        const serverMessage = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message
          : undefined;
        setError(
          serverMessage ?? `${CLAIM_TYPE_LABEL[type]} 조회에 실패했습니다. 다시 시도해주세요.`
        );
        setClaims([]);
      } finally {
        setIsLoading(false);
      }
    },
    [claimUseCase]
  );

  // Reuse SellerUseCase.getAll() for the dropdown; a failure only costs the options.
  useEffect(() => {
    const loadSellers = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        // Non-blocking: dropdown falls back to '전체' only
      }
    };
    loadSellers();
  }, [sellerUseCase]);

  // On first entry: load the default window without requiring a search click.
  // Inline async IIFE — the project's lint (react-hooks/set-state-in-effect) rejects a
  // synchronous setState in an effect body.
  useEffect(() => {
    void (async () => {
      await fetchClaims(initialClaimTypeRef.current, '', RECENT_PERIOD, '');
    })();
  }, [fetchClaims]);

  // 알림에서 들어온 경우(D9): 목록 필터와 무관하게 그 건의 모달을 바로 연다.
  // 🔴 목록에서 찾지 말 것 — 기본 필터(접수 + 최근 2주) 밖의 건이면 영영 못 찾는다.
  useEffect(() => {
    if (!deepLinkClaimId) return;
    void (async () => {
      try {
        setSelectedClaim(await claimUseCase.getClaim(Number(deepLinkClaimId)));
      } catch {
        // 없는 건(이미 종결·삭제)이면 그냥 목록만 보여준다 — 모달 대신 화면이 비는 게 낫다.
      }
    })();
  }, [deepLinkClaimId, claimUseCase]);

  /**
   * 모달을 닫으면 URL 도 정리한다 — 딥링크 파라미터를 남기면 새로고침마다 모달이 다시 열리고,
   * 다른 건을 보다 F5 하면 엉뚱한 건이 뜬다.
   */
  const handleCloseModal = useCallback(() => {
    setSelectedClaim(null);
    if (deepLinkClaimId) router.replace(ROUTES.ORDERS_CLAIMS);
  }, [deepLinkClaimId, router]);

  // The status chips are a client-side filter — clicking one never hits the server.
  // The keyword is the opposite: it goes with the [조회] request.
  const visible = useMemo(
    () => (selectedStatus ? claims.filter((c) => c.status === selectedStatus) : claims),
    [claims, selectedStatus]
  );

  const statusCounts = useMemo(
    () =>
      claims.reduce<Partial<Record<ClaimStatus, number>>>((acc, claim) => {
        acc[claim.status] = (acc[claim.status] ?? 0) + 1;
        return acc;
      }, {}),
    [claims]
  );

  // Sort the filtered list, then page it.
  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => {
      const comparison = a.receivedAt.localeCompare(b.receivedAt);
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return copy;
  }, [visible, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const paged = useMemo(
    () => sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [sorted, currentPage]
  );

  const handleSearch = () => {
    void fetchClaims(claimType, selectedSellerId, selectedPeriod, searchTerm);
  };

  // Seller/period/keyword carry over — following one order context across both tabs is natural.
  // `selectedPeriod`/`searchTerm` are pending values (see above), and a tab switch applies them
  // exactly like [조회] does.
  const handleTypeChange = (next: ClaimType) => {
    if (next === claimType || isLoading) return;
    setClaimType(next);
    // Required: the chip list differs per tab, so a stale selection (e.g. 확인요청 on 교환)
    // would filter the list to zero rows with nothing on screen explaining why.
    // Reset to the default (접수) rather than 전체 — both tabs carry that chip.
    setSelectedStatus(DEFAULT_STATUS);
    setCurrentPage(0);
    setSelectedClaim(null);
    void fetchClaims(next, selectedSellerId, selectedPeriod, searchTerm);
  };

  // Chip changes reset to page 1 — filtering from page 3 would show a blank list.
  const handleStatusChange = (status: ClaimStatus | null) => {
    setSelectedStatus(status);
    setCurrentPage(0);
  };

  /**
   * 액션 성공(또는 409) 뒤 단건 재조회 결과를 받는다(2609_21 D8).
   * 두 state 를 **함께** 바꾼다 — `claims` 만 고치면 열려 있는 모달이 낡은 채 남고,
   * `selectedClaim` 만 고치면 목록 행이 낡은다. 전체 재조회는 금지(필터·페이지·스크롤이 날아간다).
   */
  const handleActionDone = (updated: Claim) => {
    setClaims((prev) => prev.map((claim) => (claim.id === updated.id ? updated : claim)));
    setSelectedClaim((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const handleToggleSort = () => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(0);
  };

  const statusFilters = claimType === 'EXCHANGE' ? EXCHANGE_STATUS_FILTERS : RETURN_STATUS_FILTERS;
  const typeLabel = CLAIM_TYPE_LABEL[claimType];

  // "no data" and "filtered out" mean different things to the user.
  const emptyMessage =
    selectedStatus != null && claims.length > 0
      ? `이 상태의 ${typeLabel}이 없습니다.`
      : `해당 기간에 ${typeLabel} 내역이 없습니다.`;

  return (
    <PageContainer title="반품/교환">
      <ClaimTypeTabs value={claimType} onChange={handleTypeChange} disabled={isLoading} />

      <ClaimSearchCard
        sellers={sellers}
        selectedSellerId={selectedSellerId}
        onSellerChange={setSelectedSellerId}
        periodOptions={periodOptions}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearch}
        isLoading={isLoading}
        resultCount={visible.length}
      />

      <ClaimStatusFilter
        statuses={statusFilters}
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        counts={statusCounts}
        totalCount={claims.length}
      />

      <ClaimTable
        claimType={claimType}
        claims={paged}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
        sortDir={sortDir}
        onToggleSort={handleToggleSort}
        onRowClick={setSelectedClaim}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        emptyMessage={emptyMessage}
      />

      <ClaimDetailsModal
        claim={selectedClaim}
        onClose={handleCloseModal}
        onActionDone={handleActionDone}
      />
    </PageContainer>
  );
}
