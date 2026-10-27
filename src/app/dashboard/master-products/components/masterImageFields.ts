import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import type { ImageField, ImageFieldFilter } from './MasterImagePool';

/**
 * Derives the `MasterImagePool` field list (shared by the master create form + the master detail [이미지] section).
 * File: src/app/dashboard/master-products/components/masterImageFields.ts
 *
 * **Purpose**: turns the cover photo + one image group per thumbnail template + the detail image group catalog
 * into one flat field list (FEATURE_2610_33 D14).
 * - `fields` = cover photo (`SOURCE_ZONE`, always first, `single`) + **one group per thumbnail template**
 *   (key = the server's `imageGroupKey`, label = 「썸네일 · {name}」 + 「 (기본)」 for the default, template
 *   list order, `single`) + **the whole detail group catalog** (key = code, label = name, catalog sortOrder).
 *   Groups no template uses are included too — that is what "shared list" means (use a filter to see one
 *   template only). Detail groups are shared across templates, so a card never repeats per template.
 * - `fieldFilters` = **filter-only** sets (cover photo + one per thumbnail template, kind `cover` · one per detail
 *   template that has a bound image zone, kind `detail`). Render order is always decided by `fields`.
 * - `requiredZoneKeys` = **the default detail template only**. Used only by the create form's submit gate; the
 *   detail page does not use it.
 * - Any of the three lists failing (detail groups · detail templates · thumbnail templates) = non-blocking →
 *   the cover photo only. Inactive thumbnail templates are listed too (the server list returns all of them).
 *
 * **Required rules**:
 * - Whoever passes `fields`/`fieldFilters` to `MasterImagePool` (the parent container) uses this function.
 *   Do not write new code that walks `listTemplates()` to collect zones (the derivation rules would split).
 * - Never build a thumbnail template group key on the client — use `imageGroupKey` from the server (D9).
 * - ⚠️ Not a pure function (server calls) → call it inside `useEffect` and keep the result in state.
 * - ⚠️ There are **only two callers**: the create form · the master detail page.
 *   `StructuredDataPane` derives from a **single template**, so it must not switch to this (different need).
 *
 * @example
 * useEffect(() => {
 *   let alive = true;
 *   void (async () => {
 *     const { fields, fieldFilters } = await deriveMasterImageFields(
 *       detailUseCase,
 *       groupUseCase,
 *       thumbnailTemplateUseCase,
 *     );
 *     if (alive) { setImageFields(fields); setImageFieldFilters(fieldFilters); }
 *   })();
 *   return () => { alive = false; };
 * }, [detailUseCase, groupUseCase, thumbnailTemplateUseCase]);
 */
export async function deriveMasterImageFields(
  detailUseCase: DetailContentUseCase,
  groupUseCase: DetailImageGroupUseCase,
  thumbnailTemplateUseCase: ThumbnailTemplateUseCase,
): Promise<{
  fields: ImageField[];
  fieldFilters: ImageFieldFilter[];
  requiredZoneKeys: string[];
}> {
  // Cover photo is a template-independent filter, always first.
  const filters: ImageFieldFilter[] = [{ label: '대표사진', keys: [SOURCE_ZONE], kind: 'cover' }];
  try {
    const [groups, templates, thumbnailTemplates] = await Promise.all([
      groupUseCase.list(),
      detailUseCase.listTemplates(),
      thumbnailTemplateUseCase.list(),
    ]);
    for (const t of thumbnailTemplates) {
      filters.push({
        label: t.name + (t.isDefault ? ' (기본)' : ''),
        keys: [t.imageGroupKey],
        kind: 'cover',
      });
    }
    for (const t of templates) {
      const zoneKeys = (t.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string);
      if (zoneKeys.length > 0) {
        filters.push({ label: t.name + (t.isDefault ? ' (기본)' : ''), keys: zoneKeys, kind: 'detail' });
      }
    }
    return {
      // Order: cover photo → thumbnail template groups (server list order) → detail groups (catalog sortOrder,
      // the backend sorts) — never re-sort by template.
      fields: [
        { key: SOURCE_ZONE, label: '대표사진', single: true },
        ...thumbnailTemplates.map((t) => ({
          key: t.imageGroupKey,
          label: '썸네일 · ' + t.name + (t.isDefault ? ' (기본)' : ''),
          single: true,
        })),
        ...groups.map((g) => ({ key: g.code, label: g.name })),
      ],
      fieldFilters: filters,
      requiredZoneKeys: (templates.find((t) => t.isDefault)?.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string),
    };
  } catch {
    return {
      fields: [{ key: SOURCE_ZONE, label: '대표사진', single: true }],
      fieldFilters: filters,
      requiredZoneKeys: [],
    };
  }
}
