'use client';

import { X } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import type { SyncTarget } from '@/application/dto/OrderDTOs';

/** 채널(계정) 1개의 동기화 진행 상태. 순서 = 서버가 준 동기화 대상 순서. */
export type ChannelProgress = {
  target: SyncTarget;
  state: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
};

/**
 * 주문 동기화 진행 모달 (채널별 진행률 + 완료 리포트)
 *
 * 동기화 중에는 화면을 차단해 "어느 판매자·어느 플랫폼을 조회 중인지"와 진행률을 보여주고,
 * 끝나면 채널별 성공/실패를 요약해 실패한 채널만 다시 조회하게 한다.
 *
 * ⚠️ 여닫기는 `open`(부모의 `syncModalOpen`)이 소유한다. `isRunning`으로 여닫지 말 것 —
 * 동기화가 끝나도 결과 리포트를 보여주려 모달은 열려 있어야 한다.
 * ⚠️ 진행 중에는 오버레이 클릭·ESC로 닫히지 않는다(닫기 버튼도 렌더하지 않음).
 * ⚠️ 진행률 분모는 `channels.length`(서버가 준 동기화 대상 수)다.
 *
 * @param open          모달 표시 여부
 * @param channels      채널별 진행 상태(진행률 분모 = 길이)
 * @param doneCount     완료한 채널 수(진행률 분자)
 * @param isRunning     루프 진행 중 여부(모달 표시 여부와 별개 — 푸터 버튼 전환·닫기 차단 판단용)
 * @param canceled      취소로 중단됐는지(헤더 문구용)
 * @param onCancel      취소 요청(진행 중인 채널은 끝까지 조회한 뒤 멈춤)
 * @param onRetryFailed 실패한 채널만 다시 조회
 * @param onClose       닫기(진행 중에는 호출되지 않음)
 */
interface SyncProgressModalProps {
  open: boolean;
  channels: ChannelProgress[];
  doneCount: number;
  isRunning: boolean;
  canceled: boolean;
  onCancel: () => void;
  onRetryFailed: () => void;
  onClose: () => void;
}

function channelLabel(target: SyncTarget): string {
  const alias = target.accountAlias ? ` · ${target.accountAlias}` : '';
  return `${target.sellerName} · ${target.platform}${alias}`;
}

const STATE_ICON: Record<Exclude<ChannelProgress['state'], 'running'>, string> = {
  pending: '·',
  success: '✓',
  failed: '✕',
};

const STATE_CLASS: Record<ChannelProgress['state'], string> = {
  pending: 'text-gray-400',
  running: 'text-blue-600',
  success: 'text-green-600',
  failed: 'text-red-600',
};

export function SyncProgressModal({
  open,
  channels,
  doneCount,
  isRunning,
  canceled,
  onCancel,
  onRetryFailed,
  onClose,
}: SyncProgressModalProps) {
  if (!open) return null;

  const total = channels.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const successCount = channels.filter((c) => c.state === 'success').length;
  const failedCount = channels.filter((c) => c.state === 'failed').length;
  const running = channels.find((c) => c.state === 'running');

  const heading = isRunning
    ? `동기화 중… (${doneCount}/${total})`
    : `동기화 완료 · 성공 ${successCount} / 실패 ${failedCount}${canceled ? ' · 중단됨' : ''}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">{heading}</h3>
          {!isRunning && (
            <button
              onClick={onClose}
              aria-label="닫기"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>

        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        </div>

        {running && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <Spinner />
            <span className="truncate">{channelLabel(running.target)}</span>
          </div>
        )}

        <ul className="mt-4 max-h-72 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-lg">
          {channels.map((channel) => (
            <li key={channel.target.accountId} className="px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-4 text-center ${STATE_CLASS[channel.state]}`}>
                  {channel.state === 'running' ? (
                    <Spinner size={14} />
                  ) : (
                    STATE_ICON[channel.state]
                  )}
                </span>
                <span className="truncate text-gray-900">{channelLabel(channel.target)}</span>
              </div>
              {channel.state === 'failed' && channel.error && (
                <p className="mt-1 pl-6 text-xs text-red-700 line-clamp-2" title={channel.error}>
                  {channel.error}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-2 pt-6">
          <p className="text-xs text-gray-500">
            {isRunning ? '진행 중인 채널은 끝까지 조회한 뒤 멈춥니다.' : ''}
          </p>
          <div className="flex gap-2">
            {isRunning ? (
              <button
                onClick={onCancel}
                title="진행 중인 채널은 끝까지 조회한 뒤 멈춥니다."
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
            ) : (
              <>
                {failedCount > 0 && (
                  <button
                    onClick={onRetryFailed}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    실패한 채널만 다시 조회
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
