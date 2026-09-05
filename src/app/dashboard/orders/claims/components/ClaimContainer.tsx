'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ClaimSearchCard } from './ClaimSearchCard';
import { ClaimTypeTabs } from './ClaimTypeTabs';
import { ClaimStatusFilter } from './ClaimStatusFilter';
import { ClaimTable } from './ClaimTable';
import { ClaimDetailsModal } from './ClaimDetailsModal';

const PAGE_SIZE = 20;

export function ClaimContainer() {
  const claimUseCase = useMemo(() => new ClaimUseCase(new ClaimRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<ClaimStatus | null>(null);
  // Picked in the dropdown but only applied to the list on [조회].
  const [selectedPeriod, setSelectedPeriod] = useState<string>(RECENT_PERIOD);
  const [searchTerm, setSearchTerm] = useState('');
  // 접수일 single axis — there is no sort key state.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  // The tab is a server axis: switching it refetches.
  const [claimType, setClaimType] = useState<ClaimType>('RETURN');

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
      await fetchClaims('RETURN', '', RECENT_PERIOD, '');
    })();
  }, [fetchClaims]);

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
    setSelectedStatus(null);
    setCurrentPage(0);
    setSelectedClaim(null);
    void fetchClaims(next, selectedSellerId, selectedPeriod, searchTerm);
  };

  // Chip changes reset to page 1 — filtering from page 3 would show a blank list.
  const handleStatusChange = (status: ClaimStatus | null) => {
    setSelectedStatus(status);
    setCurrentPage(0);
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
    <PageContainer contentClassName="max-w-7xl mx-auto space-y-6">
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

      <ClaimDetailsModal claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
    </PageContainer>
  );
}
