'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { SOURCE_ZONE, type MasterPoolImage } from '@/domain/entities/DetailTemplateEntity';
import { THUMBNAIL_PHOTO_FIELD } from '@/domain/entities/ThumbnailPhotoEntity';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';
import { DragNotice } from '@/presentation/components/WideScreenOnly';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { MasterImagePickerModal, type PickerImage } from './MasterImagePickerModal';
import { MasterPoolManageModal } from './MasterPoolManageModal';

// Right-column filter sentinels: "썸네일 템플릿 전체"(all cover groups) / "상세 템플릿 전체"(all detail templates).
const COVER_ALL = '__cover_all__';
const DETAIL_ALL = '__detail_all__';

// Create-mode token namespacing: file-buffer tokens are indices (0..n); product-reference
// tokens are PRODUCT_OFFSET + productImageId so the two never collide in the unified token space.
const PRODUCT_OFFSET = 1_000_000_000;

/**
 * Shared UI of the master image pool + field mapping (detail zones + cover photo + thumbnail photo).
 * File: src/app/dashboard/master-products/components/MasterImagePool.tsx
 *
 * **Layout**:
 *   - Left bottom 「사용 중인 이미지」: every image in use — mapped to any field, or chosen by a seller/listing
 *     thumbnail photo stage (FEATURE_2610_32 D34) — in one flat management view (drag to reuse it in another field,
 *     remove with the ✕ on the right).
 *   - Left top, two source tabs: [제품 이미지] (component galleries shown directly) / [마스터 이미지 풀] (uploads).
 *   - Right: field drop zones (cover photo + thumbnail photo + detail zones) = mapping management.
 *
 * **Product images = option A (view directly + auto-reference on use)**:
 *   The [제품 이미지] tab shows the component galleries as they are. Dragging one onto a field on the right creates
 *   a reference entry in the master pool at that moment (backend 40 import, zero copy, live) and maps it.
 *   A reference released from every field and not used by any thumbnail photo stage (orphan) is deleted
 *   automatically (sweep), so unused references do not pile up in the pool.
 *   → No "import modal" or "reference cannot be removed" concept (references stay an internal detail).
 *
 * **Required rules**:
 *   - Do not build a direct-upload <input> per field (upload = pool only).
 *   - Pool image `imageUrl` is a complete URL → <img src> directly (no resolveThumbUrl).
 *     ⚠️ `ProductImage.imageUrl` of the [제품 이미지] tab is a stored value → use `resolveThumbUrl` (as the gallery).
 *   - Cover photo key = `SOURCE_ZONE` (single). Thumbnail photo key = `THUMBNAIL_PHOTO_FIELD` (single, the master
 *     stage of the thumbnail-photo API — never a zone mapping). Zone fields = multiple.
 *   - `fields` is derived and injected by the parent. Rendering is **always flat** (`fields` order as is).
 *     Given `fieldFilters`, the top filter bar (전체 / 썸네일 템플릿 / 상세 템플릿) is drawn — not for grouping.
 *
 * **Modes**:
 *   - Edit (`masterId != null`): mappings/references reach the server at once.
 *   - Create (`masterId == null`): buffer only, no server call (product photos are buffered as reference tokens
 *     and applied on save).
 *     ⚠️ The [제품 이미지] tab **shows in create mode too** — the only condition is whether both `productImageUseCase`
 *     and `sourceProducts` are given (`canUseProducts`). Missing either one drops the whole photo list.
 */
export type ImageField = { key: string; label: string };

// 필터 전용. 렌더 순서는 언제나 `fields` 가 결정한다 — 이 타입으로 묶어 그리지 말 것.
export type ImageFieldFilter = {
  label: string; // Shown in the select (template name / '대표사진' / '썸네일 사진')
  keys: string[]; // 이 필터가 통과시키는 field.key 집합
  kind: 'cover' | 'detail'; // 어느 셀렉트에 들어갈지
};

export type MasterImageBuffer = {
  files: File[]; // upload queue (order = pool sortOrder)
  assignments: Record<string, number[]>; // fieldKey → file-index array (source ≤ 1)
  // Create mode only: product gallery images mapped to fields, imported + mapped on submit.
  productAssignments?: Record<string, number[]>; // fieldKey → productImageId array
};

// A pool entry unified across modes. `token` = image id (edit) or file index (create).
// `isReference` = the entry live-links a product gallery image (backend 40). References are
// created/removed automatically by the "제품 이미지" tab flow, so the "마스터 이미지 풀" tab
// (removable) only ever contains master-owned entries.
// `usedForThumbnail` = chosen by any thumbnail photo stage (edit only; create = false, FEATURE_2610_32 D34).
type PoolEntry = { token: number; url: string; isReference: boolean; usedForThumbnail: boolean };

type ProductSection = { productId: number; name: string; images: ProductImage[] };

interface MasterImagePoolProps {
  masterId: number | null;
  detailUseCase: DetailContentUseCase;
  fields: ImageField[];
  fieldFilters?: ImageFieldFilter[];
  // Create mode only: parent holds the buffer as the single source of truth.
  buffer?: MasterImageBuffer;
  onBufferChange?: (next: MasterImageBuffer) => void;
  // Edit mode: notify the parent a mapping changed (detail editor tab2 → zoneDirty · master 「이미지」 tab →
  // the 「단계별 썸네일 사진」 block reloads, FEATURE_2610_32 D34).
  onDirty?: () => void;
  // Edit mode: a change of this value reloads the pool and the thumbnail photo stages (the master 「이미지」 tab
  // bumps it after the 「단계별 썸네일 사진」 block changes a stage, FEATURE_2610_32 D34).
  reloadKey?: number;
  // Optional (backend 40): enable the "제품 이미지" source tab (direct view + auto-reference on map)
  // when both are given and masterId != null (edit mode). Omit → tab hidden (create mode / no BOM).
  productImageUseCase?: ProductImageUseCase;
  sourceProducts?: { id: number; name: string }[];
}

export function MasterImagePool({
  masterId,
  detailUseCase,
  fields,
  fieldFilters,
  buffer,
  onBufferChange,
  onDirty,
  reloadKey,
  productImageUseCase,
  sourceProducts,
}: MasterImagePoolProps) {
  const isEdit = masterId != null;
  // The 「썸네일 사진」 card is present only when the parent's field list has it (StructuredDataPane does not).
  const hasThumbnailField = fields.some((f) => f.key === THUMBNAIL_PHOTO_FIELD);
  // Product images are directly viewable/usable whenever a BOM is available (edit = auto-import on
  // map; create = buffered as product refs, imported + mapped on submit).
  const canUseProducts = productImageUseCase != null && (sourceProducts?.length ?? 0) > 0;

  // ---- Edit-mode server state ----
  const [pool, setPool] = useState<MasterPoolImage[]>([]);
  // Master-stage thumbnail photo (pool image id) — the 「썸네일 사진」 card in edit mode (FEATURE_2610_32 D13).
  const [masterThumbnailId, setMasterThumbnailId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Clicking an Active-card field tag highlights that field card on the right for 2s.
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Below 768px the photos are not draggable and one notice line sits above the pool (FEATURE_2610_31 D19).
  const isMobile = useIsMobile();
  const fieldCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ---- Source tab ----
  const [activeTab, setActiveTab] = useState<'product' | 'master'>(
    canUseProducts ? 'product' : 'master',
  );
  const [productSections, setProductSections] = useState<ProductSection[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // The MASTER row's own choice; any other source = the card is empty.
  const loadMasterThumbnail = useCallback(async () => {
    if (masterId == null || !hasThumbnailField) return null;
    const stages = await detailUseCase.listThumbnailPhotoStages(masterId);
    const row = stages.find((s) => s.stage === 'MASTER');
    return row?.source === 'OWN' ? row.imageId : null;
  }, [detailUseCase, masterId, hasThumbnailField]);

  const reload = useCallback(async () => {
    if (masterId == null) return;
    const list = await detailUseCase.listPoolImages(masterId);
    setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
    setMasterThumbnailId(await loadMasterThumbnail());
  }, [detailUseCase, masterId, loadMasterThumbnail]);

  useEffect(() => {
    if (masterId == null) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await detailUseCase.listPoolImages(masterId);
        const thumbnailId = await loadMasterThumbnail();
        if (alive) {
          setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
          setMasterThumbnailId(thumbnailId);
        }
      } catch {
        if (alive) setError('이미지 풀을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, masterId, loadMasterThumbnail]);

  // Reload on the parent's signal; 0 / undefined = the first render, already loaded above.
  useEffect(() => {
    if (!reloadKey || masterId == null) return;
    let alive = true;
    (async () => {
      try {
        const list = await detailUseCase.listPoolImages(masterId);
        const thumbnailId = await loadMasterThumbnail();
        if (alive) {
          setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
          setMasterThumbnailId(thumbnailId);
        }
      } catch {
        if (alive) setError('이미지 풀을 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, detailUseCase, masterId, loadMasterThumbnail]);

  // ---- Load the BOM products' galleries for the "제품 이미지" tab (both create and edit) ----
  useEffect(() => {
    if (!canUseProducts || productImageUseCase == null) return;
    let alive = true;
    (async () => {
      setProductLoading(true);
      const loaded = await Promise.all(
        (sourceProducts ?? []).map(async (p) => ({
          productId: p.id,
          name: p.name,
          images: await productImageUseCase.list(p.id).catch(() => [] as ProductImage[]),
        })),
      );
      if (alive) {
        setProductSections(loaded);
        setProductLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canUseProducts, masterId, productImageUseCase, sourceProducts]);

  // ---- Create-mode object URL previews (revoked on change/unmount) ----
  const bufferFiles = buffer?.files;
  const previews = useMemo(
    () => (isEdit ? [] : (bufferFiles ?? []).map((f) => URL.createObjectURL(f))),
    [isEdit, bufferFiles],
  );
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  // productImageId → gallery url (create-mode product refs render from this).
  const productUrlById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of productSections) for (const img of s.images) m.set(img.id, img.imageUrl);
    return m;
  }, [productSections]);

  // Create-mode product-reference tokens currently mapped to any field (union of productAssignments).
  const mappedProductIds = useMemo(
    () => [...new Set(Object.values(buffer?.productAssignments ?? {}).flat())],
    [buffer],
  );

  // ---- Unified pool entries ----
  const entries: PoolEntry[] = useMemo(() => {
    if (isEdit)
      return pool.map((img) => ({
        token: img.id,
        url: img.imageUrl,
        isReference: img.productImageId != null,
        usedForThumbnail: img.usedForThumbnail,
      }));
    // Create mode: file-buffer previews (index tokens) + mapped product refs (offset tokens).
    const fileEntries = previews.map((url, index) => ({
      token: index,
      url,
      isReference: false,
      usedForThumbnail: false,
    }));
    const productEntries = mappedProductIds.map((id) => ({
      token: PRODUCT_OFFSET + id,
      url: resolveThumbUrl(productUrlById.get(id) ?? ''),
      isReference: true,
      usedForThumbnail: false,
    }));
    return [...fileEntries, ...productEntries];
  }, [isEdit, pool, previews, mappedProductIds, productUrlById]);

  const entryByToken = useMemo(() => {
    const map = new Map<number, PoolEntry>();
    for (const e of entries) map.set(e.token, e);
    return map;
  }, [entries]);

  // productImageId → its pool reference entry (for the "사용중" badge + reusing an existing ref).
  const refByProductImageId = useMemo(() => {
    const map = new Map<number, MasterPoolImage>();
    for (const img of pool) if (img.productImageId != null) map.set(img.productImageId, img);
    return map;
  }, [pool]);

  // Tokens currently mapped to a field (in mapping order).
  const fieldTokens = useCallback(
    (fieldKey: string): number[] => {
      if (!isEdit) {
        const fileToks = buffer?.assignments[fieldKey] ?? [];
        const prodToks = (buffer?.productAssignments?.[fieldKey] ?? []).map((id) => PRODUCT_OFFSET + id);
        return [...fileToks, ...prodToks];
      }
      if (fieldKey === SOURCE_ZONE) return pool.filter((i) => i.isSource).map((i) => i.id);
      if (fieldKey === THUMBNAIL_PHOTO_FIELD) return masterThumbnailId == null ? [] : [masterThumbnailId];
      return pool.filter((i) => i.assignedZones.includes(fieldKey)).map((i) => i.id);
    },
    [isEdit, buffer, pool, masterThumbnailId],
  );

  // Field labels this token is used in (badges).
  const badgesForToken = useCallback(
    (token: number): string[] =>
      fields.filter((f) => fieldTokens(f.key).includes(token)).map((f) => f.label),
    [fields, fieldTokens],
  );

  // Fields (key + label) this token is mapped to — Active tags link to these field cards.
  const fieldsForToken = useCallback(
    (token: number): ImageField[] => fields.filter((f) => fieldTokens(f.key).includes(token)),
    [fields, fieldTokens],
  );

  // In use = mapped to a field, or chosen by any thumbnail photo stage (FEATURE_2610_32 D34).
  const inUseToken = useCallback(
    (entry: PoolEntry): boolean => entry.usedForThumbnail || badgesForToken(entry.token).length > 0,
    [badgesForToken],
  );

  // ---- Auto-cleanup: delete product references no longer mapped anywhere and not chosen as a thumbnail photo
  //      by any stage (keeps the pool clean, FEATURE_2610_32 D11) ----
  const sweepOrphanReferences = useCallback(async () => {
    if (!isEdit || masterId == null) return;
    try {
      const fresh = await detailUseCase.listPoolImages(masterId);
      const orphans = fresh.filter(
        (i) =>
          i.productImageId != null &&
          !i.isSource &&
          !i.usedForThumbnail &&
          i.assignedZones.length === 0,
      );
      if (orphans.length === 0) return;
      for (const o of orphans) await detailUseCase.deletePoolImage(masterId, o.id);
      await reload();
    } catch {
      // best-effort; leave the reference if cleanup fails.
    }
  }, [isEdit, masterId, detailUseCase, reload]);

  // The 「썸네일 사진」 card writes the MASTER stage of the thumbnail-photo API (FEATURE_2610_32 D13 · D23).
  const setMasterThumbnail = useCallback(
    async (id: number, imageId: number | null) => {
      await detailUseCase.setThumbnailPhoto(id, {
        stage: 'MASTER',
        sellerId: null,
        listingId: null,
        imageId,
      });
    },
    [detailUseCase],
  );

  // ---- Commit a field's mapping (edit → server, create → buffer) ----
  const commit = useCallback(
    async (fieldKey: string, tokens: number[]) => {
      const isSingle = fieldKey === SOURCE_ZONE || fieldKey === THUMBNAIL_PHOTO_FIELD;
      const capped = isSingle ? tokens.slice(0, 1) : tokens;
      if (!isEdit) {
        // Split the unified tokens back into file indices and product image ids.
        const fileToks = capped.filter((t) => t < PRODUCT_OFFSET);
        const prodIds = capped.filter((t) => t >= PRODUCT_OFFSET).map((t) => t - PRODUCT_OFFSET);
        onBufferChange?.({
          files: buffer?.files ?? [],
          assignments: { ...(buffer?.assignments ?? {}), [fieldKey]: fileToks },
          productAssignments: { ...(buffer?.productAssignments ?? {}), [fieldKey]: prodIds },
        });
        return;
      }
      if (masterId == null) return;
      setError('');
      setBusy(true);
      try {
        if (fieldKey === SOURCE_ZONE) await detailUseCase.setSourceImage(masterId, capped[0] ?? null);
        else if (fieldKey === THUMBNAIL_PHOTO_FIELD) await setMasterThumbnail(masterId, capped[0] ?? null);
        else await detailUseCase.setZoneImages(masterId, fieldKey, capped);
        await reload();
        await sweepOrphanReferences();
        onDirty?.();
      } catch {
        setError('매핑 변경에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [
      isEdit,
      masterId,
      detailUseCase,
      reload,
      onDirty,
      onBufferChange,
      buffer,
      sweepOrphanReferences,
      setMasterThumbnail,
    ],
  );

  const addToField = (fieldKey: string, token: number) => {
    if (fieldKey === SOURCE_ZONE || fieldKey === THUMBNAIL_PHOTO_FIELD) {
      void commit(fieldKey, [token]);
      return;
    }
    const current = fieldTokens(fieldKey);
    if (current.includes(token)) return; // dedup
    void commit(fieldKey, [...current, token]);
  };

  const removeFromField = (fieldKey: string, token: number) => {
    void commit(
      fieldKey,
      fieldTokens(fieldKey).filter((t) => t !== token),
    );
  };

  // ---- A-flow: map a product image → auto-import a reference (if needed) then map it ----
  const importThenMap = async (fieldKey: string, productImageId: number) => {
    if (masterId == null) return;
    setError('');
    setBusy(true);
    try {
      let ref = refByProductImageId.get(productImageId);
      let freshPool = pool;
      if (!ref) {
        await detailUseCase.importProductImages(masterId, [productImageId]);
        const list = await detailUseCase.listPoolImages(masterId);
        freshPool = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
        setPool(freshPool);
        ref = freshPool.find((i) => i.productImageId === productImageId);
      }
      if (!ref) throw new Error('reference not found after import');
      // Map using the fresh pool (avoid stale fieldTokens after import).
      if (fieldKey === SOURCE_ZONE) {
        await detailUseCase.setSourceImage(masterId, ref.id);
      } else if (fieldKey === THUMBNAIL_PHOTO_FIELD) {
        await setMasterThumbnail(masterId, ref.id);
      } else {
        const currentZoneIds = freshPool
          .filter((i) => i.assignedZones.includes(fieldKey))
          .map((i) => i.id);
        const nextIds = currentZoneIds.includes(ref.id)
          ? currentZoneIds
          : [...currentZoneIds, ref.id];
        await detailUseCase.setZoneImages(masterId, fieldKey, nextIds);
      }
      await reload();
      // Replacing the cover or thumbnail photo can orphan a previous product reference → sweep.
      await sweepOrphanReferences();
      onDirty?.();
    } catch {
      setError('상품 이미지 매핑에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Upload into the master pool ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    if (!isEdit) {
      onBufferChange?.({
        files: [...(buffer?.files ?? []), ...selected],
        assignments: buffer?.assignments ?? {},
        productAssignments: buffer?.productAssignments ?? {},
      });
      return;
    }
    if (masterId == null) return;
    setError('');
    setBusy(true);
    try {
      for (const file of selected) {
        await detailUseCase.uploadPoolImage(masterId, file);
      }
      await reload();
    } catch {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Delete master-owned pool images (multi, from the manage modal). References are
  //      auto-managed, never deleted here. Backend clears mappings for deleted images. ----
  const handleDeletePoolImages = async (tokens: number[]) => {
    if (tokens.length === 0) return;
    if (!isEdit) {
      // Buffer mode: drop the selected file indices and reindex the remaining assignments.
      const remove = new Set(tokens);
      const files = buffer?.files ?? [];
      const kept = files.map((_, i) => i).filter((i) => !remove.has(i));
      const remap = new Map<number, number>();
      kept.forEach((oldIdx, newIdx) => remap.set(oldIdx, newIdx));
      const nextFiles = kept.map((i) => files[i]);
      const nextAssignments: Record<string, number[]> = {};
      for (const [k, arr] of Object.entries(buffer?.assignments ?? {})) {
        nextAssignments[k] = arr.filter((t) => !remove.has(t)).map((t) => remap.get(t)!);
      }
      // Product refs are keyed by productImageId (not file index) → unaffected by file removal.
      onBufferChange?.({
        files: nextFiles,
        assignments: nextAssignments,
        productAssignments: buffer?.productAssignments ?? {},
      });
      return;
    }
    if (masterId == null) return;
    setError('');
    setBusy(true);
    try {
      for (const token of tokens) {
        await detailUseCase.deletePoolImage(masterId, token);
      }
      await reload();
      onDirty?.();
    } catch {
      setError('이미지 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- 확대 보기 (공용 ImageLightbox) ----
  // 썸네일이 작아 무슨 사진인지 구분이 안 되던 문제. 목록별로 형제 사진을 함께 넘겨 ◀▶ 로 넘긴다.
  const [zoom, setZoom] = useState<{ urls: string[]; index: number } | null>(null);
  const openZoom = (urls: string[], index: number) => setZoom({ urls, index });

  // ---- Drag / drop ----
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const handleDrop = (fieldKey: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverField(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (raw === '') return;
    if (raw.startsWith('pi:')) {
      const productImageId = Number(raw.slice(3));
      if (Number.isNaN(productImageId)) return;
      // Edit = import a reference then map; create = buffer it as an offset product token.
      if (isEdit) void importThenMap(fieldKey, productImageId);
      else addToField(fieldKey, PRODUCT_OFFSET + productImageId);
      return;
    }
    const token = Number(raw);
    if (Number.isNaN(token)) return;
    addToField(fieldKey, token);
  };

  // ---- Group filter chips (null = 전체) ----
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // ---- [선택] picker (pool entries only; product images are added by drag) ----
  const [pickerField, setPickerField] = useState<ImageField | null>(null);
  const pickerImages: PickerImage[] = entries.map((e) => ({ token: e.token, url: e.url }));

  // ---- [이미지 관리] popup (multi-select delete of master-owned images) ----
  const [manageOpen, setManageOpen] = useState(false);

  const activeEntries = entries.filter((e) => inUseToken(e));
  const masterEntries = entries.filter((e) => !e.isReference);

  // Right-column filter: 전체 chip + 썸네일 템플릿 select (cover) + 상세 템플릿 select (detail).
  // ⚠️ 필터는 어느 카드를 "보일지"만 정한다 — 렌더 순서/그룹핑은 언제나 `fields` 가 소유한다.
  const keysOf = (filters: ImageFieldFilter[]) => new Set(filters.flatMap((f) => f.keys));
  const coverFilters = (fieldFilters ?? []).filter((f) => f.kind === 'cover');
  const detailFilters = (fieldFilters ?? []).filter((f) => f.kind === 'detail');
  const coverCurrent =
    activeGroup === COVER_ALL || coverFilters.some((f) => f.label === activeGroup);
  const detailCurrent =
    activeGroup === DETAIL_ALL || detailFilters.some((f) => f.label === activeGroup);
  const visibleKeys: Set<string> | null =
    activeGroup == null
      ? null // 전체
      : activeGroup === COVER_ALL
        ? keysOf(coverFilters)
        : activeGroup === DETAIL_ALL
          ? keysOf(detailFilters)
          : keysOf((fieldFilters ?? []).filter((f) => f.label === activeGroup));
  const visibleFields = visibleKeys == null ? fields : fields.filter((f) => visibleKeys.has(f.key));
  // 필터바가 있는 화면(마스터 생성/상세)만 카드 목록을 자체 스크롤 영역에 담는다.
  // `StructuredDataPane` 은 필터 없이 부모 흐름에 그대로 얹혀야 해서 wrapper 를 투명하게(`contents`) 둔다.
  const hasFilters = (fieldFilters?.length ?? 0) > 0;

  // Reveal a field card on the right (switch filter to 전체 if it's currently hidden) and
  // highlight it for 2s. Used by the clickable field tags on Active-card thumbnails.
  const highlightField = (fieldKey: string) => {
    if (visibleKeys != null && !visibleKeys.has(fieldKey)) {
      setActiveGroup(null); // 전체 → ensure the target card is rendered
    }
    setHighlightedField(fieldKey);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedField(null), 2000);
  };

  // Scroll the highlighted field card into view once it is rendered.
  useEffect(() => {
    if (highlightedField == null) return;
    fieldCardRefs.current
      .get(highlightedField)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightedField]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  // One field drop-zone card.
  const renderFieldCard = (field: ImageField) => {
    const tokens = fieldTokens(field.key);
    const isSingle = field.key === SOURCE_ZONE || field.key === THUMBNAIL_PHOTO_FIELD;
    const highlighted = field.key === highlightedField;
    return (
      <div
        key={field.key}
        ref={(el) => {
          if (el) fieldCardRefs.current.set(field.key, el);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverField(field.key);
        }}
        onDragLeave={() => setDragOverField((f) => (f === field.key ? null : f))}
        onDrop={(e) => handleDrop(field.key, e)}
        className={`rounded-lg border p-3 transition-all ${
          dragOverField === field.key
            ? 'border-blue-400 bg-blue-50'
            : highlighted
              ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
              : 'border-gray-200'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">
            {field.label}
            {isSingle && <span className="ml-1 text-gray-400">(단일)</span>}
          </span>
          <button
            type="button"
            onClick={() => setPickerField(field)}
            disabled={busy}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            선택
          </button>
        </div>
        {tokens.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-gray-400">
            이미지를 여기로 드래그하거나 [선택]으로 매핑하세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* 확대 보기의 형제 목록 = 이 필드에 매핑된 사진들. 빠진 엔트리는 미리 걸러 순번을 맞춘다. */}
            {tokens
              .map((token) => entryByToken.get(token))
              .filter((entry): entry is PoolEntry => entry != null)
              .map((entry, i, mapped) => (
                <div
                  key={entry.token}
                  className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.url}
                    alt="매핑 이미지"
                    onClick={() => openZoom(mapped.map((m) => m.url), i)}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => removeFromField(field.key, entry.token)}
                    disabled={busy}
                    aria-label="매핑 해제"
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-red-600/90 text-[10px] text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  // One pool thumbnail card. Deletion lives in the [이미지 관리] popup, not per-card.
  //  - `badge='fields'` (default): field-location chips plus the 「단계별 썸네일 사진」 tag for a photo chosen only
  //    by a seller/listing stage (Active Image = the "where is it used" management view, FEATURE_2610_32 D34).
  //  - `badge='inUse'`: single "사용중" badge only, like a product image card (마스터 이미지 풀 tab).
  //  - `siblings`/`index`: the photos of the same list to page through with ◀▶ in the zoom view (the caller
  //    passes them).
  const renderPoolCard = (
    entry: PoolEntry,
    opts?: { badge?: 'fields' | 'inUse'; siblings?: string[]; index?: number },
  ) => {
    const badgeMode = opts?.badge ?? 'fields';
    const badges = badgesForToken(entry.token);
    const inUse = inUseToken(entry);
    // Chosen only by a seller/listing stage (no field card to point at) → a plain 「단계별 썸네일 사진」 tag (D34).
    const stageOnly = entry.usedForThumbnail && entry.token !== masterThumbnailId;
    return (
      <div
        key={entry.token}
        draggable={!isMobile}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(entry.token))}
        className="cursor-grab overflow-hidden rounded border border-gray-200 p-2 active:cursor-grabbing"
      >
        <div className="relative aspect-square overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.url}
            alt="풀 이미지"
            onClick={() => openZoom(opts?.siblings ?? [entry.url], opts?.index ?? 0)}
            className="h-full w-full cursor-zoom-in object-contain"
          />
          {badgeMode === 'inUse' && inUse && (
            <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white">
              사용중
            </span>
          )}
        </div>
        {badgeMode === 'fields' && (badges.length > 0 || stageOnly) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {fieldsForToken(entry.token).map((f) => (
              <button
                key={f.key}
                type="button"
                title={`${f.label} — 클릭하면 오른쪽에서 위치 표시`}
                onClick={(e) => {
                  e.stopPropagation();
                  highlightField(f.key);
                }}
                className="min-w-0 max-w-full truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 hover:bg-blue-200"
              >
                {f.label}
              </button>
            ))}
            {stageOnly && (
              <span className="min-w-0 max-w-full truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700">
                단계별 썸네일 사진
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // One product-gallery image card (제품 이미지 탭). Drag → edit: auto-reference+map · create: buffer.
  const renderProductImageCard = (pi: ProductImage, siblings?: string[], index?: number) => {
    const ref = isEdit ? refByProductImageId.get(pi.id) : undefined;
    const inUse = isEdit
      ? ref != null && (ref.isSource || ref.usedForThumbnail || ref.assignedZones.length > 0)
      : mappedProductIds.includes(pi.id);
    // Edit reuses an existing reference's pool id when present; otherwise (and always in create) the
    // `pi:` token routes through the drop handler (importThenMap / buffer).
    const dragToken = ref ? String(ref.id) : `pi:${pi.id}`;
    return (
      <div
        key={pi.id}
        draggable={!isMobile}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', dragToken)}
        className="relative cursor-grab rounded border border-gray-200 p-1 active:cursor-grabbing"
      >
        <div className="aspect-square overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveThumbUrl(pi.imageUrl)}
            alt="상품 이미지"
            onClick={() => openZoom(siblings ?? [resolveThumbUrl(pi.imageUrl)], index ?? 0)}
            className="h-full w-full cursor-zoom-in object-contain"
          />
        </div>
        {inUse && (
          <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white">
            사용중
          </span>
        )}
      </div>
    );
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-lg border border-gray-200">
        <Spinner size={20} label="이미지 풀 불러오는 중..." />
      </div>
    );
  }

  const productEmpty = productSections.every((s) => s.images.length === 0);

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <DragNotice />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ---- Left: source chips + list (top), Active Image (bottom) — mirrors the right column ---- */}
        <div className="space-y-3">
          {/* Source chips (extracted like the right column's chip filter) + master actions. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {canUseProducts && (
              <button
                type="button"
                onClick={() => setActiveTab('product')}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  activeTab === 'product'
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                제품 이미지
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                activeTab === 'master'
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              마스터 이미지 풀
            </button>
          </div>

          {/* Source list (selected chip). Master actions sit top-right, like the field [선택] button. */}
          <div className="flex h-64 flex-col rounded-lg border border-gray-200 p-3">
            {activeTab === 'master' && (
              <div className="mb-2 flex items-center justify-end gap-1.5 max-md:flex-wrap">
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  disabled={busy || masterEntries.length === 0}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  이미지 관리
                </button>
                <label className="cursor-pointer rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                  이미지 업로드
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={handleUpload}
                    disabled={busy}
                    hidden
                  />
                </label>
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeTab === 'product' ? (
                productLoading ? (
                  <div className="flex min-h-24 items-center justify-center">
                    <Spinner size={18} label="상품 이미지 불러오는 중..." />
                  </div>
                ) : productEmpty ? (
                  <p className="py-6 text-center text-xs text-gray-500">
                    구성상품에 등록된 이미지가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {productSections.map((section) => (
                      <div key={section.productId}>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {section.name}
                        </p>
                        {section.images.length === 0 ? (
                          <p className="text-[11px] text-gray-400">이미지 없음</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {section.images.map((pi, i, all) =>
                              renderProductImageCard(
                                pi,
                                all.map((x) => resolveThumbUrl(x.imageUrl)),
                                i,
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : masterEntries.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">
                  [이미지 업로드]로 마스터 전용 이미지를 추가하세요.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {masterEntries.map((e, i, all) =>
                    renderPoolCard(e, { badge: 'inUse', siblings: all.map((x) => x.url), index: i }),
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Image (bottom) = images in use anywhere (field-agnostic). */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">
              사용 중인 이미지
            </p>
            <div className="max-h-44 overflow-y-auto pr-1">
              {activeEntries.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  사용중인 이미지가 없습니다. 위 소스에서 오른쪽 필드로 드래그하세요.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeEntries.map((e, i, all) =>
                    renderPoolCard(e, { siblings: all.map((x) => x.url), index: i }),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Right: field drop zones. Fills the column height to match the left. ---- */}
        <div className="flex h-full flex-col gap-3">
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  activeGroup == null
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                전체
              </button>
              {coverFilters.length > 0 && (
                <select
                  value={coverCurrent ? (activeGroup as string) : ''}
                  onChange={(e) => setActiveGroup(e.target.value || null)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    coverCurrent
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <option value="" hidden>
                    썸네일 템플릿
                  </option>
                  <option value={COVER_ALL}>썸네일 템플릿 전체</option>
                  {coverFilters.map((f) => (
                    <option key={f.label} value={f.label}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
              {detailFilters.length > 0 && (
                <select
                  value={detailCurrent ? (activeGroup as string) : ''}
                  onChange={(e) => setActiveGroup(e.target.value || null)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    detailCurrent
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <option value="" hidden>
                    상세 템플릿
                  </option>
                  <option value={DETAIL_ALL}>상세 템플릿 전체</option>
                  {detailFilters.map((f) => (
                    <option key={f.label} value={f.label}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div
            className={hasFilters ? 'min-h-0 flex-1 space-y-3 overflow-y-auto px-1' : 'contents'}
          >
            {visibleFields.map((field) => renderFieldCard(field))}
          </div>
        </div>
      </div>

      {pickerField && (
        <MasterImagePickerModal
          key={pickerField.key}
          fieldLabel={pickerField.label}
          single={pickerField.key === SOURCE_ZONE || pickerField.key === THUMBNAIL_PHOTO_FIELD}
          images={pickerImages}
          initialSelected={fieldTokens(pickerField.key)}
          onConfirm={(tokens) => {
            void commit(pickerField.key, tokens);
            setPickerField(null);
          }}
          onClose={() => setPickerField(null)}
        />
      )}

      {manageOpen && (
        <MasterPoolManageModal
          images={masterEntries.map((e) => ({
            token: e.token,
            url: e.url,
            inUse: inUseToken(e),
          }))}
          onDelete={handleDeletePoolImages}
          onClose={() => setManageOpen(false)}
        />
      )}

      <ImageLightbox
        images={(zoom?.urls ?? []).map((url) => ({ url }))}
        index={zoom?.index ?? null}
        onIndexChange={(i) => setZoom((z) => (z ? { ...z, index: i } : z))}
        onClose={() => setZoom(null)}
      />
    </div>
  );
}
