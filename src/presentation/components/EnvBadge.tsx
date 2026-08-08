'use client';

/**
 * Dev guardrail badge showing which backend the app currently targets.
 *
 * Reads NEXT_PUBLIC_SERVER_API_URL (build-time inlined) and classifies:
 *   - contains 'localhost' -> LOCAL
 *   - contains 'api-dev'   -> DEV
 *   - anything else (incl. empty/undefined) -> PROD
 *
 * PROD renders nothing (null) so production screens stay clean. Only LOCAL/DEV
 * show a small fixed badge at the bottom-right.
 *
 * ⚠️ NEXT_PUBLIC_* is inlined at build time: after changing an env file, restart
 * `next dev` (or rebuild) for the badge/target to update.
 *
 * File: src/presentation/components/EnvBadge.tsx (mounted in app/layout.tsx)
 */

type Env = 'LOCAL' | 'DEV' | 'PROD';

function resolveEnv(url: string | undefined): Env {
  if (!url) return 'PROD';
  if (url.includes('localhost')) return 'LOCAL';
  if (url.includes('api-dev')) return 'DEV';
  return 'PROD';
}

export function EnvBadge() {
  const url = process.env.NEXT_PUBLIC_SERVER_API_URL;
  const env = resolveEnv(url);

  if (env === 'PROD') return null;

  const label = env === 'LOCAL' ? 'LOCAL · :8083' : 'DEV · api-dev';
  const color = env === 'LOCAL' ? 'bg-amber-500' : 'bg-purple-600';

  return (
    <span
      className={`fixed bottom-2 right-2 z-50 rounded-md px-2 py-1 text-xs font-semibold text-white shadow ${color}`}
    >
      {label}
    </span>
  );
}
