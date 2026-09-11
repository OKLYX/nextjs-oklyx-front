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
import type {
  PayoutSummary,
  SaleMonthSettlement,
  SettlementSyncTarget,
} from '@/domain/entities/Settlement';
import {
  channelLabel,
  formatDateTime,
  monthLabel,
  monthRange,
  monthsBetween,
} from '@/domain/entities/Settlement';
import { PayoutFilter, type PayoutFilterValue } from './PayoutFilter';
import { SyncBar } from './SyncBar';
import { PayoutTable } from './PayoutTable';
import { SaleMonthTable } from './SaleMonthTable';
import { SettlementBackfillDialog } from './SettlementBackfillDialog';

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
  // 04 의 "금액 차이 N건" 배지에서 넘어오면 그 상태만 보여준다. 목록 API 에는 확인 상태 파라미터가 없어
  // 클라이언트에서 좁히고, 해제할 수 있도록 칩으로 드러낸다.
  const [reconStatusFilter, setReconStatusFilter] = useState(
    () => searchParams.get('reconStatus') ?? ''
  );

  const [filter, setFilter] = useState<PayoutFilterValue>(initialFilter);

  /**
   * 🔴 두 축을 <b>화면에서 갈라 본다</b>(FEATURE_2609_34). `payout` = 정산 건에서 판매를 내려다보기,
   * `saleMonth` = 판매에서 정산 시점을 올려다보기. 한 표에 섞으면 어느 축의 숫자인지 매번 되물어야 한다.
   */
  const [viewMode, setViewMode] = useState<'payout' | 'saleMonth'>('payout');
  const [saleMonths, setSaleMonths] = useState<SaleMonthSettlement[]>([]);
  const [saleMonthsLoading, setSaleMonthsLoading] = useState(false);
  const [saleMonthsError, setSaleMonthsError] = useState('');
  const [rows, setRows] = useState<PayoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [targets, setTargets] = useState<SettlementSyncTarget[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [payoutSyncing, setPayoutSyncing] = useState(false);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState('');
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

  // 판매월 축은 채널·기간이 모두 있어야 부를 수 있다(서버가 400 을 준다).
  const saleMonthQuery =
    viewMode === 'saleMonth' && filter.accountId !== '' && filter.from && filter.to
      ? { accountId: Number(filter.accountId), from: filter.from, to: filter.to }
      : null;

  const loadSaleMonths = useCallback(async () => {
    if (saleMonthQuery == null) {
      setSaleMonths([]);
      return;
    }
    setSaleMonthsLoading(true);
    setSaleMonthsError('');
    try {
      setSaleMonths(await settlementUseCase.getSaleMonthSettlements(saleMonthQuery));
    } catch (e) {
      setSaleMonthsError(extractErrorMessage(e, '판매월 정산 조회에 실패했습니다.'));
      setSaleMonths([]);
    } finally {
      setSaleMonthsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementUseCase, viewMode, filter.accountId, filter.from, filter.to]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint 가 막는다 — effect 는 호출만 한다.
    void (async () => {
      await loadSaleMonths();
    })();
  }, [loadSaleMonths, reloadTick]);

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
        `채널 ${result.accounts}개 · 판매 ${result.lines}건 갱신 (매칭 ${result.matched} · 미분류 ${result.unmatched})`
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
        `지급 묶음 ${result.payouts}건 · 조정 ${result.adjustments}건 갱신 (판매 건 연결 ${result.attributedLines}건)`
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

  /**
   * 과거 정산 백필 (FEATURE_2609_31 / 02 · PLAN 2609_31 D2 · D5 · D6 · D8 · D10 · D11).
   *
   * 🔴 <b>매출내역 전 구간 → 지급내역 전 구간</b> 순서를 지킨다(D2). 라인 귀속은 라인이 이미
   *    적재돼 있다는 전제 위에서 돈다 — 월별로 번갈아 부르면 `attributedLines = 0` 인 정산 건만 쌓인다.
   * 🔴 <b>순차 실행</b>이다. `Promise.all` 로 월을 병렬로 던지면 429(쿨다운)를 자초한다.
   * 🔴 429 를 만나면 <b>즉시 중단</b>한다(D6) — 남은 회차는 쿨다운 중이라 왕복만 낭비한다.
   * ⚠️ 끝나면 목록·대상만 다시 읽고 <b>사용자의 기간 필터는 건드리지 않는다</b>(D8). 그래서 필터 밖의
   *    과거 정산은 목록에 안 보일 수 있어 결과 문구에 한 줄을 덧붙인다(D11).
   * ⚠️ `[지급내역: n일 전]` 라벨은 백필 후에도 바뀌지 않는다 — `month` 지정 적재는 앵커를 찍지 않는
   *    것이 의도다(D3). 초기 백필 기회를 소진하지 않기 위한 규칙이다.
   * ⚠️ <b>`useEffect` 에서 부르지 않는다</b>(D7). 트리거는 다이얼로그의 [불러오기] 뿐이다.
   */
  const handleBackfill = useCallback(
    async (accountId: number, fromMonth: string, toMonth: string) => {
      const months = monthsBetween(fromMonth, toMonth);
      if (months.length === 0) return;
      const total = months.length * 2; // 매출 1 + 지급 1 (진행률 분모)
      const target = channels.find((channel) => channel.accountId === accountId);
      const name = target ? channelLabel(target) : `채널 #${accountId}`;
      const periodLabel = `${monthLabel(months[0])}~${monthLabel(months[months.length - 1])}`;
      // 같은 달이 매출·지급 양쪽에서 실패할 수 있다 — 문구에 두 번 찍히지 않게 Set 으로 모은다.
      const failedMonths = new Set<string>();
      let done = 0;
      let rateLimited = false;
      let payouts = 0;
      let adjustments = 0;
      let attributedLines = 0;

      const isRateLimit = (e: unknown) =>
        axios.isAxiosError(e) && e.response?.status === 429;

      setBackfillRunning(true);
      setSyncNotice('');
      setSyncError('');
      try {
        // 1단계 — 매출내역(정산 라인). 실패한 달은 접어두고 계속한다: 라인이 없으면
        // `attributedLines` 가 0 일 뿐이고 정산 건 자체는 보인다(2609_30 D5-5).
        for (const month of months) {
          setBackfillProgress(`${name} · 매출 ${monthLabel(month)} (${done + 1}/${total})`);
          try {
            const { from, to } = monthRange(month); // `to` 는 오늘을 넘지 않는다(D10)
            const result = await settlementUseCase.syncRevenuePeriod(accountId, from, to);
            // 계정 단위 실패는 서버가 200 안에 담아 보낸다(2609_30 관례).
            if (result.failedAccounts.length > 0) failedMonths.add(monthLabel(month));
          } catch (e) {
            if (isRateLimit(e)) {
              rateLimited = true;
              handleSyncFailure(e, '쿠팡 호출이 일시 제한되었습니다.');
              break;
            }
            failedMonths.add(monthLabel(month));
          }
          done += 1;
        }

        // 2단계 — 지급내역(정산 건). 매출이 다 끝난 뒤에 돈다(D2).
        if (!rateLimited) {
          for (const month of months) {
            setBackfillProgress(`${name} · 지급 ${monthLabel(month)} (${done + 1}/${total})`);
            try {
              const result = await settlementUseCase.syncPayouts(accountId, month);
              payouts += result.payouts;
              adjustments += result.adjustments;
              attributedLines += result.attributedLines;
              if (result.failedAccounts.length > 0) failedMonths.add(monthLabel(month));
            } catch (e) {
              if (isRateLimit(e)) {
                rateLimited = true;
                handleSyncFailure(e, '쿠팡 호출이 일시 제한되었습니다.');
                break;
              }
              failedMonths.add(monthLabel(month));
            }
            done += 1;
          }
        }

        if (!rateLimited) {
          // 정산 0건은 실패가 아니다 — 그 기간에 쿠팡이 통보한 정산이 없었을 뿐이다.
          const summary =
            payouts === 0
              ? `${periodLabel}에 쿠팡이 통보한 정산이 없습니다.`
              : `${periodLabel} · 정산 ${payouts}건 · 조정 ${adjustments}건 불러왔습니다 (판매 건 연결 ${attributedLines}건)`;
          const filtered = filter.from || filter.to
            ? ' 지급일 필터가 걸려 있어 그 밖의 정산은 목록에 보이지 않습니다.'
            : '';
          setSyncNotice(`${summary}${filtered}`);
        }
        if (failedMonths.size > 0) {
          setSyncError(`실패: ${Array.from(failedMonths).join(', ')}`);
        }
      } finally {
        setBackfillRunning(false);
        setBackfillProgress('');
        setBackfillOpen(false);
        await loadTargets();
        await load();
      }
    },
    [settlementUseCase, channels, filter.from, filter.to, load, loadTargets, handleSyncFailure]
  );

  const invalidRange = Boolean(filter.from && filter.to && filter.from > filter.to);

  return (
    <PageContainer title="정산 내역">
      <SyncBar
        lastSyncedAt={lastSyncedAt}
        lastPayoutSyncedAt={lastPayoutSyncedAt}
        syncing={syncing}
        payoutSyncing={payoutSyncing}
        rateLimitedMessage={rateLimited}
        notice={syncNotice}
        error={syncError}
        backfillRunning={backfillRunning}
        onSync={handleSync}
        onSyncPayout={handleSyncPayout}
        onBackfill={() => setBackfillOpen(true)}
      />

      <SettlementBackfillDialog
        open={backfillOpen}
        channels={channels}
        running={backfillRunning}
        progress={backfillProgress}
        onConfirm={handleBackfill}
        // 진행 중에는 닫지 않는다 — 실행이 컨테이너 소유라 다이얼로그를 닫으면 진행률만 사라진다.
        onClose={() => {
          if (!backfillRunning) setBackfillOpen(false);
        }}
      />

      {/* 🔴 축 전환은 필터 <b>위</b>다 — 아래 표가 무엇을 뜻하는지 먼저 정해야 필터가 읽힌다. */}
      <div className="flex items-center gap-2">
        {([
          { key: 'payout', label: '정산 기준' },
          { key: 'saleMonth', label: '판매월 기준' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setViewMode(tab.key)}
            className={`px-3 py-2 text-sm rounded-lg border ${
              viewMode === tab.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-xs text-gray-500">
          {viewMode === 'payout'
            ? '정산 건에서 어떤 판매였는지 내려다봅니다.'
            : '판매에서 언제 정산됐는지 올려다봅니다.'}
        </span>
      </div>

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
            금액 차이만 보기
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

      {viewMode === 'payout' ? (
        <PayoutTable
          rows={visibleRows}
          loading={isLoading}
          error={error}
          onOpen={(payoutId) => router.push(ROUTES.SETTLEMENT_PAYOUT_DETAIL(payoutId))}
          onRetry={() => setReloadTick((tick) => tick + 1)}
        />
      ) : saleMonthQuery == null ? (
        // 🔴 조건을 말해 준다 — 빈 표만 보이면 "정산이 없다"로 읽힌다.
        <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-sm text-gray-500">
          판매월 기준으로 보려면 채널과 기간을 모두 골라 주세요.
        </div>
      ) : (
        <SaleMonthTable
          rows={saleMonths}
          loading={saleMonthsLoading}
          error={saleMonthsError}
          onRetry={() => setReloadTick((tick) => tick + 1)}
        />
      )}
    </PageContainer>
  );
}
