'use client';

import { useEffect, useState } from 'react';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/** Load state of one dashboard card. */
export type CardData<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Loads a card's data when the card mounts and again when `load` changes (FEATURE_2610_29 D20 — once on open, no
 * polling). Pass a `useCallback` whose dependencies are the card's period.
 */
export function useCardData<T>(load: () => Promise<T>): CardData<T> {
  const [state, setState] = useState<CardData<T>>({ status: 'loading' });

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      setState({ status: 'loading' });
      try {
        const data = await load();
        if (!ignore) setState({ status: 'ready', data });
      } catch (e) {
        if (!ignore) setState({ status: 'error', message: extractErrorMessage(e, '불러오지 못했습니다.') });
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [load]);

  return state;
}
