import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import { THUMBNAIL_PHOTO_FIELD } from '@/domain/entities/ThumbnailPhotoEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import type { ImageField, ImageFieldFilter } from './MasterImagePool';

/**
 * Derives the field list of `MasterImagePool` (shared by the master create modal and the master detail [이미지] section).
 * File: src/app/dashboard/master-products/components/masterImageFields.ts
 *
 * **Purpose**: turns the cover photo, the thumbnail photo and the detail image group catalog into one flat field
 * list.
 * - `fields` = cover photo (`SOURCE_ZONE`, always first) + thumbnail photo (`THUMBNAIL_PHOTO_FIELD`, always second,
 *   FEATURE_2610_32 D13) + **every catalog group** (key=code, label=name, catalog sortOrder order).
 *   Groups no template uses are included too — that is what "shared list" means (use a filter to see one template).
 *   Groups are shared across templates, so the same card is not repeated once per template.
 * - `fieldFilters` = **filter-only** sets (cover photo 1 + thumbnail photo 1 + one per template). Render order is
 *   always decided by `fields`.
 * - `requiredZoneKeys` = **the default template only**. Used only by the create modal's submit gate, not by detail.
 * - Catalog/template lookup failure = non-blocking → only the cover photo and the thumbnail photo are returned.
 *
 * **Required usage rules**:
 * - Whoever gives `fields`/`fieldFilters` to `MasterImagePool` (the parent container) uses this function.
 *   Do not write new code that loops `listTemplates()` to collect zones (the derivation rules would split).
 * - ⚠️ Not a pure function (server calls) → call it inside `useEffect` and keep the result in state.
 * - ⚠️ The callers are **only the create modal and the master detail**.
 *   `StructuredDataPane` derives from a **single template**, so it must not switch to this (different needs).
 *
 * @example
 * useEffect(() => {
 *   let alive = true;
 *   void (async () => {
 *     const { fields, fieldFilters } = await deriveMasterImageFields(detailUseCase, groupUseCase);
 *     if (alive) { setImageFields(fields); setImageFieldFilters(fieldFilters); }
 *   })();
 *   return () => { alive = false; };
 * }, [detailUseCase, groupUseCase]);
 */
export async function deriveMasterImageFields(
  detailUseCase: DetailContentUseCase,
  groupUseCase: DetailImageGroupUseCase,
): Promise<{
  fields: ImageField[];
  fieldFilters: ImageFieldFilter[];
  requiredZoneKeys: string[];
}> {
  // Cover photo and thumbnail photo are template-independent filters, always first.
  const filters: ImageFieldFilter[] = [
    { label: '대표사진', keys: [SOURCE_ZONE], kind: 'cover' },
    { label: '썸네일 사진', keys: [THUMBNAIL_PHOTO_FIELD], kind: 'cover' },
  ];
  try {
    const [groups, templates] = await Promise.all([
      groupUseCase.list(),
      detailUseCase.listTemplates(),
    ]);
    for (const t of templates) {
      const zoneKeys = (t.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string);
      if (zoneKeys.length > 0) {
        filters.push({ label: t.name + (t.isDefault ? ' (기본)' : ''), keys: zoneKeys, kind: 'detail' });
      }
    }
    return {
      // Order is the catalog's sortOrder (the backend sorts) — never re-sort by template.
      fields: [
        { key: SOURCE_ZONE, label: '대표사진' },
        { key: THUMBNAIL_PHOTO_FIELD, label: '썸네일 사진' },
        ...groups.map((g) => ({ key: g.code, label: g.name })),
      ],
      fieldFilters: filters,
      requiredZoneKeys: (templates.find((t) => t.isDefault)?.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string),
    };
  } catch {
    return {
      fields: [
        { key: SOURCE_ZONE, label: '대표사진' },
        { key: THUMBNAIL_PHOTO_FIELD, label: '썸네일 사진' },
      ],
      fieldFilters: filters,
      requiredZoneKeys: [],
    };
  }
}
