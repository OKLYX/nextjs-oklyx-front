'use client';

/**
 * Resolves which backend base URL the app targets, with a dev-only runtime override.
 *
 * Precedence (dev/local builds only):
 *   localStorage['dev-api-base-url']  ->  NEXT_PUBLIC_SERVER_API_URL  ->  http://localhost:8083
 *
 * The override is honored ONLY when the build is a LOCAL/DEV target (BUILD_ENV !== 'PROD'),
 * so a production bundle always talks to its built-in backend regardless of localStorage.
 *
 * ⚠️ baseURL is read once when axiosInstance is created (module load). Changing the override
 * therefore requires a page reload to take effect — EnvBadge reloads after saving.
 *
 * File: src/infrastructure/api/apiBaseUrl.ts (consumed by axiosInstance + EnvBadge)
 */

export type Env = 'LOCAL' | 'DEV' | 'PROD';

const OVERRIDE_KEY = 'dev-api-base-url';

/** Raw build-time value (may be undefined -> classified as PROD). */
const RAW_ENV_URL = process.env.NEXT_PUBLIC_SERVER_API_URL;

/** Fallback used by axios when nothing else is set (mirrors previous axiosInstance default). */
const DEFAULT_URL = RAW_ENV_URL || 'http://localhost:8083';

export function classifyEnv(url: string | undefined): Env {
  if (!url) return 'PROD';
  if (url.includes('localhost')) return 'LOCAL';
  if (url.includes('api-dev')) return 'DEV';
  return 'PROD';
}

/**
 * Classifies the environment the WEB app itself is served from, by hostname.
 * Independent of the API target so a badge can flag divergence (e.g. DEV web
 * pointed at a LOCAL backend via override).
 *   localhost / 127.0.0.1 / *.local -> LOCAL
 *   dev.* (e.g. dev.oclyx.com)       -> DEV
 *   anything else (oclyx.com)        -> PROD
 */
export function classifyWebEnv(hostname: string): Env {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return 'LOCAL';
  }
  if (hostname.startsWith('dev.') || hostname.includes('-dev.')) return 'DEV';
  return 'PROD';
}

/** Env the page is actually served from (client only; null during SSR). */
export function getWebEnv(): Env | null {
  if (typeof window === 'undefined') return null;
  return classifyWebEnv(window.location.hostname);
}

/** Environment the bundle was BUILT for. Drives whether the override + badge are active. */
export const BUILD_ENV: Env = classifyEnv(RAW_ENV_URL);

/** The env base URL the override falls back to (also the "reset to default" target). */
export const ENV_BASE_URL = DEFAULT_URL;

export function getOverrideBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function setOverrideBaseUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (url && url.trim()) {
      window.localStorage.setItem(OVERRIDE_KEY, url.trim());
    } else {
      window.localStorage.removeItem(OVERRIDE_KEY);
    }
  } catch {
    // ignore storage failures (private mode, quota) — falls back to env url
  }
}

/** Base URL the app should actually use. PROD builds ignore any override. */
export function resolveBaseUrl(): string {
  if (BUILD_ENV === 'PROD') return DEFAULT_URL;
  return getOverrideBaseUrl() || DEFAULT_URL;
}
