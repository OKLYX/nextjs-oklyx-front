'use client';

import { Button } from '@/presentation/components/ui/Button';
import { lookupPlatformLabel, type LookupPlatform, type PlatformCategoryRow } from './platformCategory';

interface PlatformCategoryRowsProps {
  /** From `platformCategoryRowsOf` (「쿠팡」 → 「11번가」 → 「G마켓 · 옥션」, own row first — D41). */
  rows: PlatformCategoryRow[];
  /** [변경] — the caller opens the picker for that platform, then 「적용 범위 선택」 (D51). */
  onChange: (platform: LookupPlatform) => void;
  /** [기준으로 되돌리기] on a 「개별 지정」 line (D44 · D52). */
  onRevert: (platform: LookupPlatform) => void;
  disabled?: boolean;
}

/**
 * Platform category lines under the standard category — one line per platform (「쿠팡」 → 「11번가」 → 「G마켓 · 옥션」,
 * the last only with a switched-on ESM channel — FEATURE_2610_26 / D45) with one [변경] each (FEATURE_2610_12 / D50).
 * Shared by the master create form and the detail 「표준 카테고리」 block.
 * File: src/app/dashboard/master-products/components/PlatformCategoryRows.tsx
 *
 * **Lines**: 「{플랫폼}: {경로}」 · own 「{플랫폼}: {경로} (개별 지정)」 + [기준으로 되돌리기] ·
 * none 「{플랫폼}: 카테고리 없음 — 올릴 수 없습니다」.
 *
 * **Usage**:
 * ```tsx
 * // Master detail (MasterCategoryPanel)
 * <PlatformCategoryRows rows={platformCategoryRowsOf(mappings, owns, activePlatforms)} onChange={setPickerPlatform}
 *   onRevert={(p) => void handleRevert(p)} disabled={busy} />
 * // Master create (after [설정적용])
 * <PlatformCategoryRows rows={platformCategoryRowsOf(createMappings, Object.values(ownPicks), activePlatforms)}
 *   onChange={setPickerPlatform} onRevert={handleRevertOwn} disabled={isSubmitting} />
 * ```
 *
 * ⚠️ Build `rows` with `platformCategoryRowsOf` — the own-row-wins order is D41, not a display choice.
 * ❌ No Naver line (2610_11 D18 (d)).
 */
export function PlatformCategoryRows({ rows, onChange, onRevert, disabled = false }: PlatformCategoryRowsProps) {
  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.platform} className="flex flex-wrap items-center gap-2">
          <p className={row.path == null ? 'text-xs text-amber-700' : 'text-xs text-gray-700'}>
            {`${lookupPlatformLabel(row.platform)}: ${row.path ?? '카테고리 없음 — 올릴 수 없습니다'}${row.own ? ' (개별 지정)' : ''}`}
          </p>
          <Button size="sm" variant="secondary" onClick={() => onChange(row.platform)} disabled={disabled}>
            변경
          </Button>
          {row.own && (
            <Button size="sm" variant="secondary" onClick={() => onRevert(row.platform)} disabled={disabled}>
              기준으로 되돌리기
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
