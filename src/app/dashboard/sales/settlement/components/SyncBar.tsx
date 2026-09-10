'use client';

import { History, RefreshCw } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { formatRelativeTime } from '@/domain/entities/Settlement';

/**
 * 정산 갱신 바 (FEATURE_2609_30 / 05 Step 4 · PLAN D11).
 *
 * 🔴 <b>화면 진입에서 갱신을 부르지 않는다.</b> 이 컴포넌트의 버튼만이 마켓 호출의 유일한 트리거다 —
 * `useEffect` 마운트에 걸면 사용자가 화면을 열 때마다 쿠팡 API 호출이 나간다(D11 이 막으려는 것).
 *
 * 🔴 <b>버튼이 둘인 이유</b>: 매출내역(라인)과 지급내역(묶음)은 수집 주기가 다르다(매일 / 주 1회).
 * 지급내역 갱신은 스케줄의 수동 보정용이라 따로 둔다.
 *
 * ⚠️ <b>per-action 스피너</b> — 누른 버튼만 비활성이고 표는 그대로 쓸 수 있다.
 * ⚠️ 429(쿨다운) 중에는 세 버튼을 <b>감춘다</b>. 연타가 쿠팡 밴을 연장하기 때문에 비활성보다 강하게 막는다.
 *
 * 🔴 <b>[과거 정산 불러오기]</b>(FEATURE_2609_31 / 02)는 다이얼로그를 여는 것뿐이고, 실제 월 루프는
 * `PayoutListContainer.handleBackfill` 이 돈다. `backfillRunning` 중에도 다른 버튼을 비활성한다 —
 * 백필이 쿠팡을 수십 번 부르는 중에 [갱신] 을 겹치면 쿨다운을 자초한다.
 */
interface SyncBarProps {
  lastSyncedAt: string | null;
  lastPayoutSyncedAt: string | null;
  syncing: boolean;
  payoutSyncing: boolean;
  /** 서버가 준 429 문구. 비어 있지 않으면 버튼을 감춘다. */
  rateLimitedMessage: string;
  /** 정상 안내(스킵·적재 결과). 실패가 아니다. */
  notice: string;
  error: string;
  /** 백필 월 루프 진행 중. 세 버튼 모두 비활성 사유다. */
  backfillRunning: boolean;
  onSync: () => void;
  onSyncPayout: () => void;
  /** 백필 다이얼로그 열기 (마켓 호출은 여기서 나가지 않는다). */
  onBackfill: () => void;
}

export function SyncBar({
  lastSyncedAt,
  lastPayoutSyncedAt,
  syncing,
  payoutSyncing,
  rateLimitedMessage,
  notice,
  error,
  backfillRunning,
  onSync,
  onSyncPayout,
  onBackfill,
}: SyncBarProps) {
  const busy = syncing || payoutSyncing || backfillRunning;

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-sm text-gray-500">
          마지막 갱신:{' '}
          <span className="font-medium text-gray-700">{formatRelativeTime(lastSyncedAt)}</span>
        </p>
        <p className="text-sm text-gray-500">
          지급내역:{' '}
          <span className="font-medium text-gray-700">{formatRelativeTime(lastPayoutSyncedAt)}</span>
        </p>

        {!rateLimitedMessage && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onSync}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? (
                <Spinner label="갱신 중..." />
              ) : (
                <>
                  <RefreshCw size={16} />
                  갱신
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onSyncPayout}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              {payoutSyncing ? <Spinner label="갱신 중..." /> : '지급내역 갱신'}
            </button>
            <button
              type="button"
              onClick={onBackfill}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              {backfillRunning ? (
                <Spinner label="불러오는 중..." />
              ) : (
                <>
                  <History size={16} />
                  과거 정산 불러오기
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {rateLimitedMessage && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {rateLimitedMessage}
        </p>
      )}
      {/* 스킵·적재 결과는 정상 안내다 — 실패색(빨강)으로 칠하지 않는다. */}
      {notice && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
