'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { SOURCE_ZONE, type MasterPoolImage } from '@/domain/entities/DetailTemplateEntity';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { MasterImagePickerModal, type PickerImage } from './MasterImagePickerModal';
import { MasterPoolManageModal } from './MasterPoolManageModal';

// Right-column filter sentinels: "썸네일 템플릿 전체"(all cover groups) / "상세 템플릿 전체"(all detail templates).
const COVER_ALL = '__cover_all__';
const DETAIL_ALL = '__detail_all__';

// Create-mode token namespacing: file-buffer tokens are indices (0..n); product-reference
// tokens are PRODUCT_OFFSET + productImageId so the two never collide in the unified token space.
const PRODUCT_OFFSET = 1_000_000_000;

/**
 * 마스터 이미지 풀 + 필드(상세 zone + 대표사진) 매핑 공통 UI.
 * File: src/app/dashboard/master-products/components/MasterImagePool.tsx
 *
 * **레이아웃**:
 *   - 왼쪽 상단 「Active Image (사용중)」: 어느 필드든 매핑된 이미지를 필드 구분 없이 flat 하게 모아
 *     보여주는 일관 관리용 뷰(드래그로 다른 필드에 재사용 가능, 제거는 오른쪽 ✕).
 *   - 왼쪽 하단 소스 탭 2개: [제품 이미지](구성상품 갤러리 바로 표시) / [마스터 이미지 풀](업로드).
 *   - 오른쪽: 필드(대표사진 + 상세 zone) 드롭존 = 매핑 관리.
 *
 * **제품 이미지 = A안(바로 보기 + 사용 시 자동 참조)**:
 *   [제품 이미지] 탭은 구성상품 갤러리를 그대로 표시한다. 그 이미지를 오른쪽 필드로 드래그하면
 *   그 순간 자동으로 마스터 풀에 참조 엔트리(backend 40 import, 복사 0·라이브)를 만들고 매핑한다.
 *   어떤 참조가 모든 필드에서 해제되면(orphan) 자동 삭제(sweep)해 풀에 안 쓰는 참조가 쌓이지 않는다.
 *   → "가져오기 모달"·"참조 제거 불가" 개념 없음(참조는 완전히 내부 구현으로 감춰짐).
 *
 * **필수 규칙**:
 *   - 필드 직접 업로드 <input> 을 만들지 말 것(업로드=풀 전용).
 *   - 풀 이미지 `imageUrl` 은 완성 URL → <img src> 직접(resolveThumbUrl 금지).
 *     ⚠️ [제품 이미지] 탭의 `ProductImage.imageUrl` 은 저장값 → `resolveThumbUrl` 사용(갤러리와 동일).
 *   - 대표사진 예약키 = `SOURCE_ZONE`(단일). zone 필드 = 다중.
 *   - `fields` 는 부모가 도출해 주입. `fieldGroups` 를 주면 우측 필드 컬럼을 템플릿별 제목으로 묶어 렌더.
 *
 * **모드**:
 *   - 수정(`masterId != null`): 매핑/참조가 즉시 서버 반영.
 *   - 생성(`masterId == null`): 서버 호출 없이 버퍼만. 제품 참조는 마스터가 없어 불가 → [제품 이미지] 탭 숨김.
 */
export type ImageField = { key: string; label: string };

// Optional grouping for the field column: render field cards under a heading (e.g. per template).
export type ImageFieldGroup = { label: string; keys: string[] };

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
type PoolEntry = { token: number; url: string; isReference: boolean };

type ProductSection = { productId: number; name: string; images: ProductImage[] };

interface MasterImagePoolProps {
  masterId: number | null;
  detailUseCase: DetailContentUseCase;
  fields: ImageField[];
  fieldGroups?: ImageFieldGroup[];
  // Create mode only: parent holds the buffer as the single source of truth.
  buffer?: MasterImageBuffer;
  onBufferChange?: (next: MasterImageBuffer) => void;
  // Edit mode: notify the parent a mapping changed (detail editor tab2 → zoneDirty).
  onDirty?: () => void;
  // Optional (backend 40): enable the "제품 이미지" source tab (direct view + auto-reference on map)
  // when both are given and masterId != null (edit mode). Omit → tab hidden (create mode / no BOM).
  productImageUseCase?: ProductImageUseCase;
  sourceProducts?: { id: number; name: string }[];
}

export function MasterImagePool({
  masterId,
  detailUseCase,
  fields,
  fieldGroups,
  buffer,
  onBufferChange,
  onDirty,
  productImageUseCase,
  sourceProducts,
}: MasterImagePoolProps) {
  const isEdit = masterId != null;
  // Product images are directly viewable/usable whenever a BOM is available (edit = auto-import on
  // map; create = buffered as product refs, imported + mapped on submit).
  const canUseProducts = productImageUseCase != null && (sourceProducts?.length ?? 0) > 0;

  // ---- Edit-mode server state ----
  const [pool, setPool] = useState<MasterPoolImage[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Clicking an Active-card field tag highlights that field card on the right for 2s.
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ---- Source tab ----
  const [activeTab, setActiveTab] = useState<'product' | 'master'>(
    canUseProducts ? 'product' : 'master',
  );
  const [productSections, setProductSections] = useState<ProductSection[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  const reload = useCallback(async () => {
    if (masterId == null) return;
    const list = await detailUseCase.listPoolImages(masterId);
    setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [detailUseCase, masterId]);

  useEffect(() => {
    if (masterId == null) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await detailUseCase.listPoolImages(masterId);
        if (alive) setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        if (alive) setError('이미지 풀을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, masterId]);

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
      }));
    // Create mode: file-buffer previews (index tokens) + mapped product refs (offset tokens).
    const fileEntries = previews.map((url, index) => ({ token: index, url, isReference: false }));
    const productEntries = mappedProductIds.map((id) => ({
      token: PRODUCT_OFFSET + id,
      url: resolveThumbUrl(productUrlById.get(id) ?? ''),
      isReference: true,
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

  const fieldByKey = useMemo(() => {
    const map = new Map<string, ImageField>();
    for (const f of fields) map.set(f.key, f);
    return map;
  }, [fields]);

  // Tokens currently mapped to a field (in mapping order).
  const fieldTokens = useCallback(
    (fieldKey: string): number[] => {
      if (!isEdit) {
        const fileToks = buffer?.assignments[fieldKey] ?? [];
        const prodToks = (buffer?.productAssignments?.[fieldKey] ?? []).map((id) => PRODUCT_OFFSET + id);
        return [...fileToks, ...prodToks];
      }
      if (fieldKey === SOURCE_ZONE) return pool.filter((i) => i.isSource).map((i) => i.id);
      return pool.filter((i) => i.assignedZones.includes(fieldKey)).map((i) => i.id);
    },
    [isEdit, buffer, pool],
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

  // ---- Auto-cleanup: delete product references no longer mapped anywhere (keeps the pool clean) ----
  const sweepOrphanReferences = useCallback(async () => {
    if (!isEdit || masterId == null) return;
    try {
      const fresh = await detailUseCase.listPoolImages(masterId);
      const orphans = fresh.filter(
        (i) => i.productImageId != null && !i.isSource && i.assignedZones.length === 0,
      );
      if (orphans.length === 0) return;
      for (const o of orphans) await detailUseCase.deletePoolImage(masterId, o.id);
      await reload();
    } catch {
      // best-effort; leave the reference if cleanup fails.
    }
  }, [isEdit, masterId, detailUseCase, reload]);

  // ---- Commit a field's mapping (edit → server, create → buffer) ----
  const commit = useCallback(
    async (fieldKey: string, tokens: number[]) => {
      const isSource = fieldKey === SOURCE_ZONE;
      const capped = isSource ? tokens.slice(0, 1) : tokens;
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
        if (isSource) await detailUseCase.setSourceImage(masterId, capped[0] ?? null);
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
    [isEdit, masterId, detailUseCase, reload, onDirty, onBufferChange, buffer, sweepOrphanReferences],
  );

  const addToField = (fieldKey: string, token: number) => {
    if (fieldKey === SOURCE_ZONE) {
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
      // Replacing the cover photo can orphan a previous product reference → sweep.
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

  const activeEntries = entries.filter((e) => badgesForToken(e.token).length > 0);
  const masterEntries = entries.filter((e) => !e.isReference);

  // Right-column filter: 전체 chip + 썸네일 템플릿 select (cover) + 상세 템플릿 select (detail).
  const coverGroups = (fieldGroups ?? []).filter((g) => g.keys.includes(SOURCE_ZONE));
  const templateGroups = (fieldGroups ?? []).filter((g) => !g.keys.includes(SOURCE_ZONE));
  const coverCurrent = activeGroup === COVER_ALL || coverGroups.some((g) => g.label === activeGroup);
  const detailCurrent =
    activeGroup === DETAIL_ALL || templateGroups.some((g) => g.label === activeGroup);
  const visibleGroups =
    activeGroup === COVER_ALL
      ? coverGroups
      : activeGroup === DETAIL_ALL
        ? templateGroups
        : activeGroup == null
          ? fieldGroups ?? []
          : (fieldGroups ?? []).filter((g) => g.label === activeGroup);

  // Reveal a field card on the right (switch filter to 전체 if it's currently hidden) and
  // highlight it for 2s. Used by the clickable field tags on Active-card thumbnails.
  const highlightField = (fieldKey: string) => {
    if (fieldGroups && !visibleGroups.some((g) => g.keys.includes(fieldKey))) {
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

  // One field drop-zone card. `reactKey` disambiguates a zone shared across groups.
  const renderFieldCard = (field: ImageField, reactKey: string) => {
    const tokens = fieldTokens(field.key);
    const isSource = field.key === SOURCE_ZONE;
    const highlighted = field.key === highlightedField;
    return (
      <div
        key={reactKey}
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
            {isSource && <span className="ml-1 text-gray-400">(단일)</span>}
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
            {tokens.map((token) => {
              const entry = entryByToken.get(token);
              if (!entry) return null;
              return (
                <div
                  key={token}
                  className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.url} alt="매핑 이미지" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => removeFromField(field.key, token)}
                    disabled={busy}
                    aria-label="매핑 해제"
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-red-600/90 text-[10px] text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // One pool thumbnail card. Deletion lives in the [이미지 관리] popup, not per-card.
  //  - `badge='fields'` (default): field-location chips (Active Image = 어디에 쓰이는지 관리 뷰).
  //  - `badge='inUse'`: single "사용중" badge only, like a product image card (마스터 이미지 풀 탭).
  const renderPoolCard = (entry: PoolEntry, opts?: { badge?: 'fields' | 'inUse' }) => {
    const badgeMode = opts?.badge ?? 'fields';
    const badges = badgesForToken(entry.token);
    const inUse = badges.length > 0;
    return (
      <div
        key={entry.token}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(entry.token))}
        className="cursor-grab overflow-hidden rounded border border-gray-200 p-2 active:cursor-grabbing"
      >
        <div className="relative aspect-square overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.url} alt="풀 이미지" className="h-full w-full object-contain" />
          {badgeMode === 'inUse' && inUse && (
            <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white">
              사용중
            </span>
          )}
        </div>
        {badgeMode === 'fields' && badges.length > 0 && (
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
          </div>
        )}
      </div>
    );
  };

  // One product-gallery image card (제품 이미지 탭). Drag → edit: auto-reference+map · create: buffer.
  const renderProductImageCard = (pi: ProductImage) => {
    const ref = isEdit ? refByProductImageId.get(pi.id) : undefined;
    const inUse = isEdit
      ? ref != null && (ref.isSource || ref.assignedZones.length > 0)
      : mappedProductIds.includes(pi.id);
    // Edit reuses an existing reference's pool id when present; otherwise (and always in create) the
    // `pi:` token routes through the drop handler (importThenMap / buffer).
    const dragToken = ref ? String(ref.id) : `pi:${pi.id}`;
    return (
      <div
        key={pi.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', dragToken)}
        className="relative cursor-grab rounded border border-gray-200 p-1 active:cursor-grabbing"
      >
        <div className="aspect-square overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveThumbUrl(pi.imageUrl)}
            alt="상품 이미지"
            className="h-full w-full object-contain"
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
              <div className="mb-2 flex items-center justify-end gap-1.5">
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
                            {section.images.map(renderProductImageCard)}
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
                  {masterEntries.map((e) => renderPoolCard(e, { badge: 'inUse' }))}
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
                  {activeEntries.map((e) => renderPoolCard(e))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Right: field drop zones. Fills the column height to match the left. ---- */}
        <div className="flex h-full flex-col gap-3">
          {fieldGroups ? (
            <>
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
                {coverGroups.length > 0 && (
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
                    {coverGroups.map((g) => (
                      <option key={g.label} value={g.label}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                )}
                {templateGroups.length > 0 && (
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
                    {templateGroups.map((g) => (
                      <option key={g.label} value={g.label}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
                {visibleGroups.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.label}
                    </p>
                    {group.keys.map((key) => {
                      const field = fieldByKey.get(key);
                      if (!field) return null;
                      return renderFieldCard(field, `${group.label}:${key}`);
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            fields.map((field) => renderFieldCard(field, field.key))
          )}
        </div>
      </div>

      {pickerField && (
        <MasterImagePickerModal
          key={pickerField.key}
          fieldLabel={pickerField.label}
          single={pickerField.key === SOURCE_ZONE}
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
            inUse: badgesForToken(e.token).length > 0,
          }))}
          onDelete={handleDeletePoolImages}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}
