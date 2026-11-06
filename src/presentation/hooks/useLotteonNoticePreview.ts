'use client';

import { useEffect, useState } from 'react';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  LOTTEON_NOTICE_PREFIX,
  type LotteonNoticePreviewRequest,
  type LotteonNotification,
} from '@/domain/entities/LotteonNotice';

/** Wait after the last keystroke before asking the server again. */
const PREVIEW_DELAY_MS = 300;

interface PreviewEntry {
  requestKey: string;
  notification: LotteonNotification | null;
  failed: boolean;
}

/**
 * The LotteON view of the master notice values on screen (FEATURE_2610_24 / D38 · D56 · D63).
 *
 * **Purpose**: asks `POST /api/admin/lotteon/notice-preview` with the chosen group's Coupang items (blank items sent as
 * '' so every item of the group is classified) + the `LOTTEON:*` values, 300 ms after the last change.
 * **File**: src/presentation/hooks/useLotteonNoticePreview.ts — the twin of `useEsmNoticePreview`.
 *
 * **Usage**:
 * ```tsx
 * const lotteonPreview = useLotteonNoticePreview(useCase, lotteonActive, group, groupNotices, noticeValues);
 * <CategoryMetaFields … lotteonPreview={lotteonActive ? lotteonPreview : undefined} />
 * ```
 *
 * ⚠️ `enabled = false` makes no call (`notification` stays null, `failed` false).
 * ⚠️ A failed call does not throw — `failed` becomes true and the screen shows its own notice.
 * ❌ Do not convert the notice values on screen — the server converts them with the same code the upload uses.
 */
export function useLotteonNoticePreview(
  useCase: MasterProductUseCase,
  enabled: boolean,
  group: string,
  groupNotices: CategoryNotice[],
  values: Record<string, string>,
): { notification: LotteonNotification | null; failed: boolean } {
  const notices: Record<string, string> = {};
  groupNotices.forEach((n) => {
    notices[n.key] = values[n.key] ?? '';
  });
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(LOTTEON_NOTICE_PREFIX)) notices[key] = value;
  });
  // The string is the effect key — a new object every render would ask the server on every render.
  const requestKey = JSON.stringify({ group, notices });

  const [entry, setEntry] = useState<PreviewEntry | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const request = JSON.parse(requestKey) as LotteonNoticePreviewRequest;
          const notification = await useCase.previewLotteonNotice(request);
          if (alive) setEntry({ requestKey, notification, failed: false });
        } catch {
          if (alive) setEntry({ requestKey, notification: null, failed: true });
        }
      })();
    }, PREVIEW_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled, useCase, requestKey]);

  // Keep showing the last answer while the next one is on its way — the fields would flicker otherwise.
  return {
    notification: enabled ? (entry?.notification ?? null) : null,
    failed: enabled && entry?.requestKey === requestKey ? entry.failed : false,
  };
}
