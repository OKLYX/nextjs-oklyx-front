'use client';

import { useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useLoggingStatus, useLoggingTargets, useSetLoggingLevel } from './hooks';
import type { LoggingStatus } from './api';

function LevelBadge({ level }: { level: LoggingStatus['level'] }) {
  const isDebug = level === 'DEBUG';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
        isDebug ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {level}
    </span>
  );
}

// Converts the DEBUG auto-revert ISO timestamp to a local HH:mm string.
function formatRevertTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusCard({ target }: { target: string }) {
  const { data: status, isLoading, isError } = useLoggingStatus(target);
  const setLevel = useSetLoggingLevel();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-red-600 text-sm">
        로그 상태를 불러오지 못했습니다. 다시 시도해주세요.
      </div>
    );
  }

  const isDebug = status.level === 'DEBUG';
  const nextLevel = isDebug ? 'INFO' : 'DEBUG';
  const toggleLabel = isDebug ? 'INFO 끄기' : 'DEBUG 켜기';

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-gray-600">{status.label}</p>
          <LevelBadge level={status.level} />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isDebug}
          disabled={setLevel.isPending}
          onClick={() => setLevel.mutate({ target, level: nextLevel })}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDebug ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className="sr-only">{toggleLabel}</span>
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isDebug ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {setLevel.isPending && <Spinner size={16} label="변경 중..." />}
        <span className="text-gray-600">{toggleLabel}</span>
      </div>

      {isDebug && status.autoRevertAt && (
        <p className="text-sm text-amber-700">
          DEBUG는 {formatRevertTime(status.autoRevertAt)}에 자동으로 INFO로 복귀합니다.
        </p>
      )}

      {setLevel.isError && (
        <p className="text-sm text-red-600">레벨 변경에 실패했습니다. 다시 시도해주세요.</p>
      )}
    </div>
  );
}

export default function LoggingSettingsPage() {
  const { data: targets, isLoading, isError } = useLoggingTargets();
  const [selectedTarget, setSelectedTarget] = useState('');

  return (
    <PageContainer contentClassName="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">로그 설정</h1>
        <p className="mt-1 text-sm text-gray-600">
          외부 연동별 로그 상세도(DEBUG/INFO)를 재배포 없이 토글합니다. DEBUG는 30분 후 자동으로 INFO로 복귀합니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {isError ? (
          <p className="text-sm text-red-600">대상 목록을 불러오지 못했습니다.</p>
        ) : (
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">{isLoading ? '불러오는 중...' : '연동 대상 선택'}</option>
            {targets?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedTarget && <StatusCard target={selectedTarget} />}
    </PageContainer>
  );
}
