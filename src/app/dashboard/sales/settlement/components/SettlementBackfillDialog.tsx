'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import {
  buildSettlementMonthOptions,
  channelLabel,
  type SettlementSyncTarget,
} from '@/domain/entities/Settlement';

/**
 * 과거 정산 백필 다이얼로그 (FEATURE_2609_31 / 02 · PLAN 2609_31 D1 · D4 · D7).
 *
 * **용도**: 사용자가 채널 1개와 시작월·종료월을 골라 과거 정산을 화면으로 끌어온다.
 * **파일**: src/app/dashboard/sales/settlement/components/SettlementBackfillDialog.tsx
 *
 * 🔴 <b>실행은 컨테이너가 한다</b> — 이 컴포넌트는 입력만 모아 `onConfirm` 으로 넘긴다.
 *    월 루프·순차 호출·429 중단은 `PayoutListContainer.handleBackfill` 소유다.
 * 🔴 <b>채널은 필수</b>다. 전체 실행은 없다 — 백엔드 요청 단위가 계정 1개다(D4).
 * ⚠️ `running` 이면 두 select 와 [닫기] 를 비활성한다. 진행 중 닫기는 컨테이너도 한 번 더 무시한다.
 */
interface SettlementBackfillDialogProps {
  open: boolean;
  /** 컨테이너가 판매자 필터로 이미 좁힌 목록. 비면 안내 문구만 보여준다. */
  channels: SettlementSyncTarget[];
  running: boolean;
  /** 진행 문구. 예: `메인 · 매출 2026년 7월 (2/24)`. 비어 있으면 표시하지 않는다. */
  progress: string;
  onConfirm: (accountId: number, fromMonth: string, toMonth: string) => void;
  /** running 이면 컨테이너가 무시한다. */
  onClose: () => void;
}

export function SettlementBackfillDialog({
  open,
  channels,
  running,
  progress,
  onConfirm,
  onClose,
}: SettlementBackfillDialogProps) {
  const monthOptions = useMemo(() => buildSettlementMonthOptions(), []);
  // 기본값: 시작월 = 3개월 전, 종료월 = 당월 (최신이 위인 목록이라 index 로 잡는다).
  const [accountId, setAccountId] = useState<number | null>(null);
  const [fromMonth, setFromMonth] = useState(
    () => (monthOptions[3] ?? monthOptions[monthOptions.length - 1])?.value ?? ''
  );
  const [toMonth, setToMonth] = useState(() => monthOptions[0]?.value ?? '');

  if (!open) return null;

  // 채널을 아직 고르지 않았으면 컨테이너가 넘긴 첫 채널이 기본값이다(select 의 초기 표시와 같다).
  const selectedAccountId = accountId ?? (channels.length > 0 ? channels[0].accountId : null);
  const invalidRange = Boolean(fromMonth && toMonth && fromMonth > toMonth);
  const disabled = running || selectedAccountId == null || invalidRange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">과거 정산 불러오기</h2>
          <p className="mt-1 text-xs text-gray-500">
            선택한 달마다 쿠팡을 2번씩 조회합니다. 기간이 길수록 오래 걸립니다.
          </p>
        </div>

        {channels.length === 0 ? (
          <p className="text-sm text-gray-500">불러올 채널이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">채널</span>
              <select
                value={selectedAccountId ?? ''}
                disabled={running}
                onChange={(event) => setAccountId(Number(event.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
              >
                {channels.map((channel) => (
                  <option key={channel.accountId} value={channel.accountId}>
                    {channelLabel(channel)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">시작월</span>
                <select
                  value={fromMonth}
                  disabled={running}
                  onChange={(event) => setFromMonth(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">종료월</span>
                <select
                  value={toMonth}
                  disabled={running}
                  onChange={(event) => setToMonth(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {invalidRange && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                시작월이 종료월보다 뒤입니다.
              </p>
            )}
          </div>
        )}

        {running && progress && (
          <p className="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">{progress}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            닫기
          </button>
          {running ? (
            <span className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white opacity-70">
              <Spinner label="불러오는 중..." />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (selectedAccountId == null) return;
                onConfirm(selectedAccountId, fromMonth, toMonth);
              }}
              disabled={disabled}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              불러오기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
