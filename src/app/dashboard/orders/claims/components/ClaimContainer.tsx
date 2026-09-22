'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ClaimRepositoryImpl } from '@/infrastructure/repositories/ClaimRepositoryImpl';
import { ClaimUseCase } from '@/application/usecases/ClaimUseCase';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { useOrderSync } from '@/presentation/hooks/useOrderSync';
import { SyncProgressModal } from '@/app/dashboard/orders/components/SyncProgressModal';
import type { SyncTarget } from '@/application/dto/OrderDTOs';
import { formatRelativeTime } from '@/domain/entities/DateTimeFormat';
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

/** 조회에 실제로 반영된 조건 — 동기화 후 재조회가 화면의 pending 값이 아니라 이 값으로 돈다. */
interface AppliedQuery {
  type: ClaimType;
  sellerId: number | '';
  period: string;
  keyword: string;
}

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
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  // 동기화 대상 = 판매자 필터가 걸린 채널들. 채널 드롭다운은 만들지 않는다 — 클레임 목록에 채널 축이 없다.
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  // 건너뛴 채널 수(D15) — 성공처럼 보이면 안 되므로 목록 위에 한 줄로 남긴다.
  const [skippedChannels, setSkippedChannels] = useState(0);
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

  const appliedQueryRef = useRef<AppliedQuery | null>(null);

  // null = do not label months with data — claims have no "months with data" API.
  const periodOptions = useMemo(() => buildPeriodOptions(null), []);

  const fetchClaims = useCallback(
    async (query: AppliedQuery) => {
      const { type, sellerId, period, keyword } = query;
      appliedQueryRef.current = query;
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

  /**
   * 동기화 대상 = `OrderUseCase.getSyncTargets()` (주문내역·고객문의와 같은 원천).
   * 판매자 필터를 바꾸면 다시 싣는다 — 그 판매자의 채널만 돌기 위해서다(채널 선택 UI 는 없다).
   * 실패는 비차단이다: 목록 조회는 그대로 돌고 [동기화] 버튼만 사유와 함께 비활성된다.
   */
  useEffect(() => {
    const loadSyncTargets = async () => {
      try {
        setSyncTargets(await orderUseCase.getSyncTargets(selectedSellerId || undefined));
      } catch {
        setSyncTargets([]);
      }
    };
    void loadSyncTargets();
  }, [orderUseCase, selectedSellerId]);

  // On first entry: load the default window without requiring a search click.
  // Inline async IIFE — the project's lint (react-hooks/set-state-in-effect) rejects a
  // synchronous setState in an effect body.
  useEffect(() => {
    void (async () => {
      await fetchClaims({
        type: initialClaimTypeRef.current,
        sellerId: '',
        period: RECENT_PERIOD,
        keyword: '',
      });
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
   * 동기화가 끝난 뒤 목록 재조회 — 마지막으로 **조회에 반영된** 조건 그대로다.
   * 그 사이 사용자가 만진 pending 값(판매자·기간·검색어)을 쓰면 다른 조회가 되어 화면이 말없이 바뀐다.
   */
  const refetchAfterSync = useCallback(async () => {
    const query = appliedQueryRef.current;
    if (query) await fetchClaims(query);
  }, [fetchClaims]);

  // 채널 루프·진행 모달·취소·채널별 실패 격리는 주문내역과 같은 훅을 쓴다(복사 금지).
  // 부르는 엔드포인트만 다르므로 표준 동기화(runSync)가 아니라 범용 러너(runChannels)를 빌린다.
  const {
    isSyncing, syncChannels, syncCursor, syncCanceled, syncModalOpen,
    runChannels, failedTargets, cancelSync, closeSyncModal, stopSyncing,
  } = useOrderSync({ onAfterSync: refetchAfterSync });

  const runClaimSync = useCallback(async (targets: SyncTarget[]) => {
    if (targets.length === 0) {
      setError('가져올 채널이 없습니다.');
      return;
    }
    setError('');
    setSkippedChannels(0);
    // 러너는 채널 상태만 찍는다 — 건너뛴 채널 수는 이 클로저가 센다(공용 훅을 고치지 않는다).
    let skipped = 0;
    await runChannels(targets, async (target) => {
      const result = await claimUseCase.syncClaims(target.accountId);
      if (result.skipped) skipped += 1;
      return result.skipped ? 'skipped' : 'success';
    });
    setSkippedChannels(skipped);
    // 루프 직후 스피너를 푼다(문의 화면과 같은 자세) — 목록 재조회는 이어서 돈다.
    stopSyncing();
    await refetchAfterSync();
  }, [runChannels, stopSyncing, refetchAfterSync, claimUseCase]);

  // 판매자 필터가 걸려 있으면 그 판매자의 채널만, 아니면 전체를 돈다(대상 목록이 이미 그렇게 실린다).
  const handleSync = () => {
    void runClaimSync(syncTargets);
  };

  const handleRetryFailed = () => {
    void runClaimSync(failedTargets);
  };

  /**
   * 「마지막 동기화」 — 서버가 채널별로 낙인한 시각 중 가장 최근 값이다(D16).
   * 값이 모두 오프셋 없는 같은 형식이라 사전순 = 시간순이다.
   */
  const lastClaimSyncedAt = useMemo(
    () =>
      syncTargets
        .map((target) => target.lastClaimSyncAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    [syncTargets]
  );

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
    void fetchClaims({
      type: claimType,
      sellerId: selectedSellerId,
      period: selectedPeriod,
      keyword: searchTerm,
    });
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
    void fetchClaims({
      type: next,
      sellerId: selectedSellerId,
      period: selectedPeriod,
      keyword: searchTerm,
    });
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
    <PageContainer
      title="반품/교환"
      action={
        <p className="text-sm text-gray-500 whitespace-nowrap">
          마지막 동기화:{' '}
          <span className="font-medium text-gray-700">{formatRelativeTime(lastClaimSyncedAt)}</span>
        </p>
      }
    >
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
        onSync={handleSync}
        isLoading={isLoading}
        isSyncing={isSyncing}
        syncDisabledReason={syncTargets.length === 0 ? '가져올 채널이 없습니다' : undefined}
        resultCount={visible.length}
      />

      <ClaimStatusFilter
        statuses={statusFilters}
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        counts={statusCounts}
        totalCount={claims.length}
      />

      {/* 건너뛴 채널은 성공처럼 보이면 안 된다 — 진행 모달이 세는 수와 같은 사실을 한 줄로 남긴다. */}
      {skippedChannels > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {skippedChannels}개 채널은 이미 동기화 중이라 건너뛰었습니다.
        </p>
      )}

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

      <SyncProgressModal
        open={syncModalOpen}
        channels={syncChannels}
        doneCount={syncCursor}
        isRunning={isSyncing}
        canceled={syncCanceled}
        onCancel={cancelSync}
        onRetryFailed={handleRetryFailed}
        onClose={closeSyncModal}
      />
    </PageContainer>
  );
}
