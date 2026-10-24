'use client';

import { useSyncExternalStore } from 'react';

/**
 * Hook that returns whether the viewport is a "narrow screen" (mobile width, below md = 767px or less).
 *
 * Purpose: for responsive splits at the **behaviour (state / event) level**, like the NavBar drawer / rail split.
 * The boundary is Tailwind `md` (768px), the same as the CSS utilities (`md:`).
 * File: src/presentation/hooks/useIsMobile.ts
 *
 * SSR safe: the server always renders false (desktop), and on client mount the value syncs to the real
 * matchMedia value (avoids a hydration mismatch). Same idea as the useSyncExternalStore client-guard pattern of the
 * TopBar dark-mode toggle.
 *
 * @returns {boolean} true when the viewport is 767px or less
 *
 * @example
 * const isMobile = useIsMobile();
 * // When the render structure itself splits, like drawer vs fixed rail
 * return isMobile ? <Drawer /> : <Rail />;
 *
 * ⚠️ For purely visual splits (column counts etc.) prefer the CSS utilities (`hidden md:block` / `md:hidden`) over
 *    this hook. Use the hook only when JS behaviour must change (avoids needless re-renders). The table ↔ card switch
 *    of a list reads it through `useShowCards` (FEATURE_2610_31 D13) — the switch also depends on the list view mode
 *    the user picked, so CSS alone cannot draw it.
 */
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
}
