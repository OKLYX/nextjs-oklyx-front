'use client';

import { useEffect, useState } from 'react';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  ESM_NOTICE_PREFIX,
  type EsmNoticePreviewRequest,
  type EsmNotification,
} from '@/domain/entities/EsmNotice';

/** Wait after the last keystroke before asking the server again. */
const PREVIEW_DELAY_MS = 300;

interface PreviewEntry {
  requestKey: string;
  notification: EsmNotification | null;
  failed: boolean;
}

/**
 * The Gmarket · Auction (ESM) view of the master notice values on screen (FEATURE_2610_26 / D17 · D46 · D56).
 *
 * **Purpose**: asks `POST /api/admin/esm/notice-preview` with the chosen group's Coupang items (blank items sent as ''
 * so every item of the group is classified) + the `ESM:*` values, 300 ms after the last change.
 * **File**: src/presentation/hooks/useEsmNoticePreview.ts — the twin of `useElevenstNoticePreview`.
 *
 * **Usage**:
 * ```tsx
 * const esmPreview = useEsmNoticePreview(useCase, esmActive, group, groupNotices, noticeValues);
 * <CategoryMetaFields … esmPreview={esmActive ? esmPreview : undefined} />
 * ```
 *
 * ⚠️ `enabled = false` makes no call (`notification` stays null, `failed` false).
 * ⚠️ A failed call does not throw — `failed` becomes true and the screen shows its own notice.
 */
export function useEsmNoticePreview(
  useCase: MasterProductUseCase,
  enabled: boolean,
  group: string,
  groupNotices: CategoryNotice[],
  values: Record<string, string>,
): { notification: EsmNotification | null; failed: boolean } {
  const notices: Record<string, string> = {};
  groupNotices.forEach((n) => {
    notices[n.key] = values[n.key] ?? '';
  });
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(ESM_NOTICE_PREFIX)) notices[key] = value;
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
          const request = JSON.parse(requestKey) as EsmNoticePreviewRequest;
          const notification = await useCase.previewEsmNotice(request);
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
