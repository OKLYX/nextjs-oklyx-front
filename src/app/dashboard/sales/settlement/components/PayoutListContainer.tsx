'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { PayoutSummary, SettlementSyncTarget } from '@/domain/entities/Settlement';
import { formatDateTime } from '@/domain/entities/Settlement';
import { PayoutFilter, type PayoutFilterValue } from './PayoutFilter';
import { SyncBar } from './SyncBar';
import { PayoutTable } from './PayoutTable';

/**
 * 지급 묶음 목록 화면의 상태 소유자 (FEATURE_2609_30 / 05 Step 2 · Step 4).
 *
 * 소유 상태 = 필터(판매자·채널·지급일 구간) · 목록 · 동기화 대상(마지막 갱신 시각) · 갱신 진행/안내.
 *
 * 🔴 <b>마운트에서 `POST /sync` 를 부르지 않는다</b>(PLAN D11). 진입 시 호출하는 것은 조회 3종
 * (`/payouts` · `/sync/targets` · 판매자 목록)뿐이고, 마켓 호출은 [갱신] 버튼에서만 나간다.
 * 검증 방법: 화면을 열고 새로고침해도 네트워크 탭에 `POST /sync` 가 없어야 한다.
 *
 * ⚠️ 진입 쿼리파라미터(`?sellerId=` · `?accountId=` · `?reconStatus=`)는 매출 화면(04)의 배지·링크가
 * 넘겨준다. <b>초기값으로만</b> 읽고 이후에는 URL 을 따라가지 않는다 — 필터를 바꿀 때마다 URL 을 쓰면
 * 뒤로가기가 필터 히스토리가 된다.
 */
export function PayoutListContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const settlementUseCase = useMemo(
    () => new SettlementUseCase(new SettlementRepositoryImpl()),
    []
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  // 최초 1회만 읽는다(위 주석) — 이후 필터 변경은 URL 을 건드리지 않는다.
  const initialFilter = useMemo<PayoutFilterValue>(() => {
    const toNumber = (raw: string | null) => (raw && !Number.isNaN(Number(raw)) ? Number(raw) : '');
    return {
      sellerId: toNumber(searchParams.get('sellerId')),
      accountId: toNumber(searchParams.get('accountId')),
      from: '',
      to: '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 04 의 "미대사 N건" 배지에서 넘어오면 그 상태만 보여준다. 목록 API 에는 대사 상태 파라미터가 없어
  // 클라이언트에서 좁히고, 해제할 수 있도록 칩으로 드러낸다.
  const [reconStatusFilter, setReconStatusFilter] = useState(
    () => searchParams.get('reconStatus') ?? ''
  );

  const [filter, setFilter] = useState<PayoutFilterValue>(initialFilter);
  const [rows, setRows] = useState<PayoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [targets, setTargets] = useState<SettlementSyncTarget[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [payoutSyncing, setPayoutSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncError, setSyncError] = useState('');
  // 429 쿨다운 문구는 서버가 준 것을 그대로 쓴다(해제 시각이 들어 있다). 값이 있으면 버튼을 감춘다.
  const [rateLimited, setRateLimited] = useState('');

  // 필터를 빠르게 바꾸면 응답이 역순으로 도착할 수 있다 — 마지막 요청의 결과만 반영한다.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (filter.from && filter.to && filter.from > filter.to) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      const result = await settlementUseCase.getPayouts({
        sellerId: filter.sellerId === '' ? undefined : filter.sellerId,
        accountId: filter.accountId === '' ? undefined : filter.accountId,
        from: filter.from || undefined,
        to: filter.to || undefined,
      });
      if (requestId !== requestIdRef.current) return;
      setRows(result);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(extractErrorMessage(e, '정산 내역 조회에 실패했습니다.'));
      setRows([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [settlementUseCase, filter]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
    // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다(04 와 같은 패턴).
    void (async () => {
      await load();
    })();
  }, [load, reloadTick]);

  // 채널 드롭다운 + "마지막 갱신" 의 출처. 실패해도 목록 조회는 계속된다(라벨만 잃는다).
  const loadTargets = useCallback(async () => {
    try {
      setTargets(
        await settlementUseCase.getSyncTargets(
          filter.sellerId === '' ? undefined : filter.sellerId
        )
      );
    } catch {
      setTargets([]);
    }
  }, [settlementUseCase, filter.sellerId]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
    // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다(04 와 같은 패턴).
    void (async () => {
      await loadTargets();
    })();
  }, [loadTargets]);

  useEffect(() => {
    sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => {
        /* 드롭다운이 '전체' 만 남는다 — 조회 자체는 동작한다 */
      });
  }, [sellerUseCase]);

  const handleFilterChange = useCallback((next: PayoutFilterValue) => {
    setFilter((prev) => {
      // 판매자를 바꾸면 이전 채널 선택은 다른 판매자의 것이라 목록에서 사라진다 — 함께 비운다.
      const sellerChanged = prev.sellerId !== next.sellerId;
      return sellerChanged ? { ...next, accountId: '' } : next;
    });
  }, []);

  const channels = useMemo(
    () =>
      filter.sellerId === ''
        ? targets
        : targets.filter((target) => target.sellerId === filter.sellerId),
    [targets, filter.sellerId]
  );

  const visibleRows = useMemo(
    () =>
      reconStatusFilter
        ? rows.filter((row) => row.reconStatus === reconStatusFilter)
        : rows,
    [rows, reconStatusFilter]
  );

  const latest = (pick: (target: SettlementSyncTarget) => string | null): string | null =>
    channels.reduce<string | null>((acc, target) => {
      const value = pick(target);
      if (!value) return acc;
      return acc == null || value > acc ? value : acc;
    }, null);

  const lastSyncedAt = latest((target) => target.lastSettlementSyncAt);
  const lastPayoutSyncedAt = latest((target) => target.lastPayoutSyncAt);

  /** 429 는 재시도가 밴을 연장하므로 버튼을 감추는 별도 상태로 옮긴다. */
  const handleSyncFailure = useCallback((e: unknown, fallback: string) => {
    if (axios.isAxiosError(e) && e.response?.status === 429) {
      setRateLimited(extractErrorMessage(e, '쿠팡 호출이 일시 제한되었습니다.'));
      return;
    }
    setSyncError(extractErrorMessage(e, fallback));
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncNotice('');
    setSyncError('');
    try {
      const result = await settlementUseCase.syncSettlement(
        filter.accountId === '' ? undefined : filter.accountId,
        filter.sellerId === '' ? undefined : filter.sellerId
      );
      if (result.skipped) {
        // 🔴 에러가 아니다 — 최소 간격(D11) 안이라 마켓을 부르지 않았다. 목록은 그대로 둔다.
        setSyncNotice(
          `방금 갱신했습니다. ${formatDateTime(result.nextAvailableAt)} 이후 다시 시도할 수 있습니다.`
        );
        return;
      }
      setSyncNotice(
        `채널 ${result.accounts}개 · 라인 ${result.lines}건 갱신 (매칭 ${result.matched} · 미분류 ${result.unmatched})`
      );
      if (result.failedAccounts.length > 0) {
        setSyncError(`일부 채널 실패: ${result.failedAccounts.join(', ')}`);
      }
      await loadTargets();
      await load();
    } catch (e) {
      handleSyncFailure(e, '정산 갱신에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  }, [settlementUseCase, filter, load, loadTargets, handleSyncFailure]);

  const handleSyncPayout = useCallback(async () => {
    setPayoutSyncing(true);
    setSyncNotice('');
    setSyncError('');
    try {
      const result = await settlementUseCase.syncPayouts(
        filter.accountId === '' ? undefined : filter.accountId
      );
      // `attributedLines === 0` 도 정상이다(ADDITIONAL·RESERVE 는 라인을 가져가지 않는다).
      setSyncNotice(
        `지급 묶음 ${result.payouts}건 · 조정 ${result.adjustments}건 갱신 (라인 귀속 ${result.attributedLines}건)`
      );
      if (result.failedAccounts.length > 0) {
        setSyncError(`일부 채널 실패: ${result.failedAccounts.join(', ')}`);
      }
      await loadTargets();
      await load();
    } catch (e) {
      handleSyncFailure(e, '지급내역 갱신에 실패했습니다.');
    } finally {
      setPayoutSyncing(false);
    }
  }, [settlementUseCase, filter.accountId, load, loadTargets, handleSyncFailure]);

  const invalidRange = Boolean(filter.from && filter.to && filter.from > filter.to);

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">정산 내역</h1>
        <p className="text-sm text-gray-500">
          쿠팡이 통보한 지급 묶음입니다. 같은 기간에 주정산과 추가정산이 함께 오는 것이 정상입니다.
        </p>
      </div>

      <SyncBar
        lastSyncedAt={lastSyncedAt}
        lastPayoutSyncedAt={lastPayoutSyncedAt}
        syncing={syncing}
        payoutSyncing={payoutSyncing}
        rateLimitedMessage={rateLimited}
        notice={syncNotice}
        error={syncError}
        onSync={handleSync}
        onSyncPayout={handleSyncPayout}
      />

      <PayoutFilter
        value={filter}
        sellers={sellers}
        channels={channels}
        disabled={isLoading}
        onChange={handleFilterChange}
      />

      {reconStatusFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            미대사만 보기
            <button
              type="button"
              onClick={() => setReconStatusFilter('')}
              className="text-amber-900 hover:underline"
            >
              해제
            </button>
          </span>
        </div>
      )}

      {invalidRange && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          시작일이 종료일보다 뒤입니다.
        </div>
      )}

      <PayoutTable
        rows={visibleRows}
        loading={isLoading}
        error={error}
        onOpen={(payoutId) => router.push(ROUTES.SETTLEMENT_PAYOUT_DETAIL(payoutId))}
        onRetry={() => setReloadTick((tick) => tick + 1)}
      />
    </PageContainer>
  );
}
