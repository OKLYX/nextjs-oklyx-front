'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { OrderSyncResponse, SyncTarget } from '@/application/dto/OrderDTOs';
import type { ChannelProgress } from '@/app/dashboard/orders/components/SyncProgressModal';

const LAST_SYNCED_AT_KEY = 'oklyx_order_last_synced_at';

const markState = (
  list: ChannelProgress[], index: number, state: ChannelProgress['state'], error?: string,
): ChannelProgress[] => list.map((c, i) => (i === index ? { ...c, state, error } : c));

// The server owns the reason text: use the received message as-is, falling back only when absent.
const extractMessage = (e: unknown): string =>
  (axios.isAxiosError(e) ? e.response?.data?.message : undefined) ?? '동기화에 실패했습니다.';

export interface UseOrderSyncOptions {
  /** 루프가 끝난 뒤 목록 재조회. 화면마다 다르므로 훅은 목록을 모른다. */
  onAfterSync: () => Promise<void> | void;
  /**
   * `runSync` 종료 직전에 await 된다. 화면이 동기화 대상을 재조회해 실패 채널의 사유를
   * `applyChannelErrors` 로 되돌리는 자리. 없으면 사유 보강을 건너뛴다.
   */
  onSyncSettled?: () => Promise<void> | void;
}

/**
 * 주문 동기화 오케스트레이션 (출고관리·주문내역 공유).
 *
 * 계정 1개씩 순차 호출한다 — 서버의 다계정 경로는 계정 격리를 하지만 진행 상황을 돌려주지
 * 않기 때문이다(FEATURE_2609_02). 채널별 실패 격리·취소·진행 커서가 여기 산다.
 *
 * **필수 사용 규칙**: 주문 동기화를 시작하는 화면은 반드시 이 훅을 쓴다.
 * **파일**: src/presentation/hooks/useOrderSync.ts
 *
 * **사용 예제**:
 * ```tsx
 * const load = useCallback(async () => { ... }, [deps]);   // 훅보다 먼저 선언 (TDZ)
 * const { runSync, isSyncing, syncChannels, failedTargets, ... } =
 *   useOrderSync({ onAfterSync: load, onSyncSettled: handleSyncSettled });
 * ```
 *
 * ⚠️ 두 화면이 이 훅 하나를 쓴다(PLAN 2609_15 D6). 복사하면 동기화 동작이 조용히 갈라진다.
 * ⚠️ 목록 재조회는 화면마다 다르므로 `onAfterSync` 로 넘긴다 — 훅은 목록을 모른다.
 * ⚠️ 에러 문구(`setError`)는 화면 상태다. 훅은 채널별 실패만 다루고 화면 에러는 건드리지 않는다.
 * ❌ 채널 루프를 화면에 복사하지 말 것 — 다른 엔드포인트를 돌려야 하면 `runChannels` 를 빌려 쓴다.
 */
export function useOrderSync({ onAfterSync, onSyncSettled }: UseOrderSyncOptions) {
  // 훅이 자기 호출(syncOrders)만 소유한다 — 화면의 usecase 인스턴스와 독립. 둘 다 무상태 래퍼다.
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncChannels, setSyncChannels] = useState<ChannelProgress[]>([]);
  const [syncCursor, setSyncCursor] = useState(0);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncCanceled, setSyncCanceled] = useState(false);
  const [syncResult, setSyncResult] = useState<OrderSyncResponse | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  // Cancel is requested through a ref so the running loop sees it without a re-render.
  const cancelRef = useRef(false);

  // localStorage is read after mount only (SSR has no window).
  useEffect(() => {
    setLastSyncedAt(localStorage.getItem(LAST_SYNCED_AT_KEY));
  }, []);

  /**
   * 범용 러너 — 진행 모달·취소·채널별 실패 격리만 한다. 호출 내용은 `callOne` 이 정한다.
   * 백필처럼 다른 엔드포인트를 쓰는 흐름은 이걸 부른다(집계는 호출부 클로저에서).
   *
   * ⚠️ `isSyncing` 을 **켜기만** 하고 끄지 않는다 — 끄는 시점이 흐름마다 다르기 때문이다
   * (표준 동기화 = 목록 재조회·localStorage 이후, 백필 = 루프 직후). 호출부가 `stopSyncing` 으로 끈다.
   */
  const runChannels = useCallback(async (
    targets: SyncTarget[],
    callOne: (target: SyncTarget) => Promise<void>,
  ) => {
    cancelRef.current = false;
    setSyncCanceled(false);
    setSyncModalOpen(true);
    setIsSyncing(true);
    setSyncChannels(targets.map((t) => ({ target: t, state: 'pending' })));
    setSyncCursor(0);

    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) {
        setSyncCanceled(true);
        break;
      }
      setSyncChannels((prev) => markState(prev, i, 'running'));
      try {
        await callOne(targets[i]);
        setSyncChannels((prev) => markState(prev, i, 'success'));
      } catch (e) {
        setSyncChannels((prev) => markState(prev, i, 'failed', extractMessage(e)));
      }
      setSyncCursor(i + 1);
    }
  }, []);

  /**
   * 표준 동기화 = `runChannels(syncOrders)` + 집계 + localStorage + 결과 배너 + `onAfterSync`.
   *
   * ⚠️ `isSyncing` 은 목록 재조회·localStorage 까지 끝낸 뒤 풀린다 — 순서를 바꾸면 스피너가
   * 재조회 도중에 먼저 풀린다.
   * ⚠️ accountId 만 보낸다 — sellerId 를 함께 보내면 서버의 accountId > sellerId 우선순위와
   * 충돌해 응답 범위가 흐려진다.
   */
  const runSync = useCallback(async (targets: SyncTarget[]) => {
    let newOrders = 0;
    let updatedOrders = 0;
    let canceledUpdated = 0;

    await runChannels(targets, async (target) => {
      const result = await orderUseCase.syncOrders({ accountId: target.accountId });
      newOrders += result.newOrders;
      updatedOrders += result.updatedOrders;
      canceledUpdated += result.canceledUpdated;
    });

    // The per-call `orders` payload is scoped by the sellerId parameter, so it is not reused here —
    // the screen refetches its own list once after the loop instead.
    await onAfterSync();

    const syncedAt = new Date().toISOString();
    setLastSyncedAt(syncedAt);
    localStorage.setItem(LAST_SYNCED_AT_KEY, syncedAt);
    setSyncResult({ syncedAt, newOrders, updatedOrders, canceledUpdated, orders: [] });
    setIsSyncing(false);

    // The reason still comes from the server (2609_02 D18), but from the channel status the sync
    // just stamped rather than the HTTP envelope: sync failures surface as IllegalStateException /
    // RestClientException, which the backend's catch-all handler answers with the generic
    // "Internal server error" body. `lastSyncError` carries the real one ("HTTP 504 from Coupang").
    await onSyncSettled?.();
  }, [orderUseCase, runChannels, onAfterSync, onSyncSettled]);

  /**
   * 실패 채널의 사유를 서버 기록(`lastSyncError`)으로 덮어쓴다 — 대상 재조회는 화면이 하고
   * (화면이 `syncTargets` 를 갖고 있다) 반영만 훅에 맡긴다.
   *
   * ⚠️ 호출 시점 = `onSyncSettled` 안. 그 밖에서 부르면 진행 모달이 이미 닫혀 있을 수 있다.
   */
  const applyChannelErrors = useCallback((errorsByAccountId: Map<number, string>) => {
    setSyncChannels((prev) => prev.map((channel) => {
      if (channel.state !== 'failed') return channel;
      const recorded = errorsByAccountId.get(channel.target.accountId);
      return recorded ? { ...channel, error: recorded } : channel;
    }));
  }, []);

  /** 진행 모달 [재시도] 용 — 실패한 채널의 target 목록. 어느 러너로 재시도할지는 화면이 정한다. */
  const failedTargets = useMemo(
    () => syncChannels.filter((c) => c.state === 'failed').map((c) => c.target),
    [syncChannels]
  );

  const cancelSync = useCallback(() => { cancelRef.current = true; }, []);
  const closeSyncModal = useCallback(() => setSyncModalOpen(false), []);
  /** `runChannels` 를 직접 쓴 흐름이 루프 종료를 알리는 자리(표준 동기화는 `runSync` 가 끈다). */
  const stopSyncing = useCallback(() => setIsSyncing(false), []);
  /** 새 조회를 시작할 때 직전 동기화 결과 배너를 지운다. */
  const clearSyncResult = useCallback(() => setSyncResult(null), []);

  return {
    isSyncing, syncChannels, syncCursor, syncCanceled, syncModalOpen, syncResult, lastSyncedAt,
    runChannels, runSync, applyChannelErrors, failedTargets,
    cancelSync, closeSyncModal, stopSyncing, clearSyncResult,
  };
}
