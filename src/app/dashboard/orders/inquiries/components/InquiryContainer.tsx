'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InquiryRepositoryImpl } from '@/infrastructure/repositories/InquiryRepositoryImpl';
import { InquiryUseCase } from '@/application/usecases/InquiryUseCase';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { INQUIRY_STATUS_FILTERS } from '@/domain/entities/InquiryEntity';
import type { Inquiry, InquiryStatus, InquiryTypeOption } from '@/domain/entities/InquiryEntity';
import { RECENT_PERIOD, buildPeriodOptions, toPeriodRange } from '@/domain/entities/OrderPeriod';
import type { Seller } from '@/domain/entities/SellerEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { PageContainer } from '@/presentation/components/PageContainer';
import {
  channelOptionLabel,
  type ChannelOption,
} from '@/app/dashboard/orders/components/OrderSearchCard';
import { InquirySearchCard } from './InquirySearchCard';
import { InquiryTypeTabs } from './InquiryTypeTabs';
import { InquiryStatusFilter } from './InquiryStatusFilter';
import { InquiryTable } from './InquiryTable';

const PAGE_SIZE = 20;

/** 조회에 실제로 반영된 조건 — [다시 시도] 가 화면의 pending 값이 아니라 이 값으로 재요청한다. */
interface AppliedQuery {
  type: string;
  accountId: number | '';
  sellerId: number | '';
  period: string;
  keyword: string;
}

export function InquiryContainer() {
  const inquiryUseCase = useMemo(() => new InquiryUseCase(new InquiryRepositoryImpl()), []);
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [typeOptions, setTypeOptions] = useState<InquiryTypeOption[]>([]);
  // The tab is a server axis: switching it refetches.
  const [selectedType, setSelectedType] = useState('');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<InquiryStatus | null>(null);
  // Picked in the card but only applied to the list on [조회].
  const [selectedPeriod, setSelectedPeriod] = useState<string>(RECENT_PERIOD);
  const [searchTerm, setSearchTerm] = useState('');
  // 문의일 single axis — there is no sort key state.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const appliedQueryRef = useRef<AppliedQuery | null>(null);

  // null = do not label months with data — inquiries have no "months with data" API.
  const periodOptions = useMemo(() => buildPeriodOptions(null), []);

  // 유형 코드 → 라벨. 원천은 서버 1곳(`/types`)이므로 화면에 유형 상수표를 두지 않는다(D4).
  const typeLabelMap = useMemo(
    () => Object.fromEntries(typeOptions.map((option) => [option.code, option.label])),
    [typeOptions]
  );

  const fetchInquiries = useCallback(
    async (query: AppliedQuery) => {
      appliedQueryRef.current = query;
      try {
        setIsLoading(true);
        setError('');
        const result = await inquiryUseCase.getInquiries({
          ...(query.type ? { type: query.type } : {}),
          ...(query.accountId !== '' ? { accountId: query.accountId } : {}),
          ...(query.sellerId !== '' ? { sellerId: query.sellerId } : {}),
          ...(query.keyword.trim() ? { keyword: query.keyword.trim() } : {}),
          period: toPeriodRange(query.period),
        });
        setInquiries(result);
        setHasSearched(true);
        setCurrentPage(0);
      } catch (err) {
        setError(extractErrorMessage(err, '고객문의 조회에 실패했습니다. 다시 시도해주세요.'));
        setInquiries([]);
      } finally {
        setIsLoading(false);
      }
    },
    [inquiryUseCase]
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
    void loadSellers();
  }, [sellerUseCase]);

  /**
   * 채널 옵션의 유일한 원천 = `OrderUseCase.getSyncTargets()` (D2).
   *
   * ⚠️ 판매자를 바꾸면 **옵션 목록만** 좁힌다. 조회 조건은 여전히 독립 AND 라 서버에는 두 값을
   * 그대로 보낸다. 좁힌 목록에 현재 선택 채널이 없으면 선택을 '전체 채널' 로 되돌린다 —
   * 그대로 두면 아무 결과도 없는 조합이 남는다.
   */
  useEffect(() => {
    const loadChannels = async () => {
      try {
        const targets = await orderUseCase.getSyncTargets(selectedSellerId || undefined);
        const options = targets.map<ChannelOption>((target) => ({
          accountId: target.accountId,
          label: channelOptionLabel(target.accountId, target.accountAlias),
          syncable: true,
        }));
        setChannelOptions(options);
        setSelectedAccountId((prev) =>
          prev !== '' && !options.some((option) => option.accountId === prev) ? '' : prev
        );
      } catch {
        setChannelOptions([]);
      }
    };
    void loadChannels();
  }, [orderUseCase, selectedSellerId]);

  // On first entry: load the type catalog, take the first type as the default tab and search once.
  // Inline async IIFE — the project's lint (react-hooks/set-state-in-effect) rejects a
  // synchronous setState in an effect body.
  useEffect(() => {
    void (async () => {
      let options: InquiryTypeOption[] = [];
      try {
        options = inquiryUseCase.flattenTypes(await inquiryUseCase.getTypes());
      } catch {
        // 유형을 못 받으면 탭 없이 전체 유형으로 조회한다 — 화면이 비지는 않는다.
      }
      setTypeOptions(options);
      const firstType = options[0]?.code ?? '';
      setSelectedType(firstType);
      await fetchInquiries({
        type: firstType,
        accountId: '',
        sellerId: '',
        period: RECENT_PERIOD,
        keyword: '',
      });
    })();
  }, [inquiryUseCase, fetchInquiries]);

  // The status chips are a client-side filter — clicking one never hits the server.
  const visible = useMemo(
    () => (selectedStatus ? inquiries.filter((i) => i.status === selectedStatus) : inquiries),
    [inquiries, selectedStatus]
  );

  const statusCounts = useMemo(
    () =>
      inquiries.reduce<Partial<Record<InquiryStatus, number>>>((acc, inquiry) => {
        acc[inquiry.status] = (acc[inquiry.status] ?? 0) + 1;
        return acc;
      }, {}),
    [inquiries]
  );

  // Sort the filtered list, then page it.
  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => {
      const comparison = a.inquiredAt.localeCompare(b.inquiredAt);
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
    void fetchInquiries({
      type: selectedType,
      accountId: selectedAccountId,
      sellerId: selectedSellerId,
      period: selectedPeriod,
      keyword: searchTerm,
    });
  };

  // Channel/seller/period/keyword carry over between tabs — the user is following one context.
  // A tab switch applies the pending values exactly like [조회] does.
  const handleTypeChange = (next: string) => {
    if (next === selectedType || isLoading) return;
    setSelectedType(next);
    // The chip counts belong to the previous type's list; keeping a selection would filter the
    // new list to zero rows with nothing on screen explaining why.
    setSelectedStatus(null);
    setCurrentPage(0);
    void fetchInquiries({
      type: next,
      accountId: selectedAccountId,
      sellerId: selectedSellerId,
      period: selectedPeriod,
      keyword: searchTerm,
    });
  };

  // Chip changes reset to page 1 — filtering from page 3 would show a blank list.
  const handleStatusChange = (status: InquiryStatus | null) => {
    setSelectedStatus(status);
    setCurrentPage(0);
  };

  const handleToggleSort = () => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(0);
  };

  // 실패한 그 조건 그대로 재요청한다 — 그 사이 사용자가 만진 pending 값을 쓰면 다른 조회가 된다.
  const handleRetry = () => {
    const query = appliedQueryRef.current;
    if (query) void fetchInquiries(query);
  };

  // "no data" and "filtered out" mean different things to the user.
  const emptyMessage =
    selectedStatus != null && inquiries.length > 0
      ? '이 상태의 문의가 없습니다.'
      : '조회 결과가 없습니다.';

  return (
    <PageContainer width="xl">
      {/* 유형이 1개뿐이면 탭 줄을 그리지 않는다 — 고를 것이 없는 탭은 자리만 차지한다. */}
      {typeOptions.length > 1 && (
        <InquiryTypeTabs
          types={typeOptions}
          value={selectedType}
          onChange={handleTypeChange}
          disabled={isLoading}
        />
      )}

      <InquirySearchCard
        channelOptions={channelOptions}
        selectedAccountId={selectedAccountId}
        onAccountChange={setSelectedAccountId}
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

      <InquiryStatusFilter
        statuses={INQUIRY_STATUS_FILTERS}
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        counts={statusCounts}
        totalCount={inquiries.length}
      />

      <InquiryTable
        inquiries={paged}
        typeLabelMap={typeLabelMap}
        isLoading={isLoading}
        error={error}
        hasSearched={hasSearched}
        sortDir={sortDir}
        onToggleSort={handleToggleSort}
        onRetry={handleRetry}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        emptyMessage={emptyMessage}
      />
    </PageContainer>
  );
}
