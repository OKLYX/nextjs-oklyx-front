'use client';

/**
 * Dev guardrail badge showing which backend the app currently targets, with a
 * click-to-switch panel that overrides the API base URL at runtime.
 *
 * Classifies the ACTIVE base URL (override ?? build env) via apiBaseUrl.classifyEnv:
 *   - contains 'localhost' -> LOCAL (amber)
 *   - contains 'api-dev'   -> DEV   (purple)
 *   - anything else        -> PROD-like custom (slate)
 *
 * The badge only renders on LOCAL/DEV BUILDS (BUILD_ENV !== 'PROD'), so production
 * screens stay clean and can never be re-pointed from the UI. Clicking it opens a
 * small panel to pick a preset or type a custom URL; saving persists the override
 * to localStorage and reloads (baseURL is read once at axiosInstance creation).
 *
 * File: src/presentation/components/EnvBadge.tsx (mounted in app/layout.tsx)
 */

import { useState, useSyncExternalStore } from 'react';
import {
  BUILD_ENV,
  ENV_BASE_URL,
  classifyEnv,
  getOverrideBaseUrl,
  getWebEnv,
  resolveBaseUrl,
  setOverrideBaseUrl,
} from '@/infrastructure/api/apiBaseUrl';

const LOCAL_URL = 'http://localhost:8083';

// Client-only gate without set-state-in-effect: server snapshot = false, client = true.
const noopSubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function colorFor(env: ReturnType<typeof classifyEnv>): string {
  if (env === 'LOCAL') return 'bg-amber-500';
  if (env === 'DEV') return 'bg-purple-600';
  return 'bg-slate-600';
}

export function EnvBadge() {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Only dev/local builds ever show the badge — production bundles render nothing.
  if (BUILD_ENV === 'PROD') return null;

  const activeUrl = mounted ? resolveBaseUrl() : ENV_BASE_URL;
  const hasOverride = mounted && !!getOverrideBaseUrl();
  const apiEnv = classifyEnv(activeUrl);
  // Where the web is actually served (null during SSR -> fall back to build env).
  const webEnv = (mounted ? getWebEnv() : null) ?? BUILD_ENV;
  const diverges = apiEnv !== webEnv;

  const presets = [{ label: 'LOCAL', url: LOCAL_URL }];
  if (ENV_BASE_URL !== LOCAL_URL) {
    presets.push({ label: `${classifyEnv(ENV_BASE_URL)} (build)`, url: ENV_BASE_URL });
  }

  const openPanel = () => {
    setDraft(activeUrl);
    setOpen(true);
  };

  const save = (url: string | null) => {
    setOverrideBaseUrl(url);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-gray-900">API Base URL</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button
                key={p.url}
                type="button"
                onClick={() => setDraft(p.url)}
                className="rounded-md border border-gray-200 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://localhost:8083"
            className="mb-2 w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => save(null)}
              disabled={!hasOverride}
              className="rounded-md px-2 py-1 font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              기본값으로 초기화
            </button>
            <button
              type="button"
              onClick={() => save(draft)}
              disabled={!draft.trim() || draft.trim() === activeUrl}
              className="rounded-md bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              저장 후 새로고침
            </button>
          </div>

          <div className="mt-2 space-y-0.5 text-[11px] leading-tight text-gray-500">
            <p>
              웹: <span className="font-medium text-gray-700">{webEnv}</span>
              {mounted && ` (${window.location.host})`}
            </p>
            <p>
              API: <span className="font-medium text-gray-700">{apiEnv}</span> — {activeUrl}
              {hasOverride && ' (override)'}
            </p>
            {diverges && (
              <p className="text-amber-600">⚠ 웹 환경과 API 대상이 다릅니다</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`rounded-md px-2 py-1 text-xs font-semibold text-white shadow ${colorFor(webEnv)} ${
          diverges ? 'ring-2 ring-amber-400' : ''
        }`}
        title={`웹 ${webEnv} · API ${apiEnv} (${activeUrl})`}
      >
        WEB:{webEnv} · API:{apiEnv}
      </button>
    </div>
  );
}
