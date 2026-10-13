'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import { CategoryLookupPickerModal } from '@/app/dashboard/costs/category/components/CategoryLookupPickerModal';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type {
  MasterCategoryResponse,
  MasterPlatformCategory,
  MasterPlatformCategoryRequest,
} from '@/domain/entities/MasterProductEntity';
import type { CategoryTreeNode } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import { MissingPlatformCategoryModal } from '../../components/MissingPlatformCategoryModal';
import { CategoryScopeDialog } from '../../components/CategoryScopeDialog';
import { PlatformCategoryRows } from '../../components/PlatformCategoryRows';
import {
  missingPlatformsOf,
  platformCategoryRowsOf,
  promptPlatformsOf,
  type LookupPlatform,
} from '../../components/platformCategory';

type PickerSelection = { platformCategoryId: string; name: string; namePath: string };

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
  mappingUseCase: CategoryMappingUseCase;
  // Reports an assignment to the parent container → sibling sections (category meta, options) switch to the
  // new category. The value is the setCategory response. The panel keeps holding its own display state.
  onCategoryChanged?: (next: MasterCategoryResponse | null) => void;
  /** Parent-owned lookup use case — the missing-platform popup and [변경] open the shared picker with it. */
  lookupUseCase: CategoryLookupUseCase;
  /** Lookup platforms with a switched-on account (D17). Empty = none / not loaded / failed → Coupang is not asked. */
  activePlatforms: LookupPlatform[];
  /** Bumped by the parent after a mapping save elsewhere on the page → this panel re-reads (D11). */
  mappingsVersion: number;
  /** A [변경] / [기준으로 되돌리기] here changed a platform category (2610_12 / D50) → the parent re-reads. */
  onPlatformCategoryChanged: () => void;
}

/**
 * Standard category assignment panel (master detail). A master points at one standard category;
 * per-mall marketplace codes are resolved by the master's own platform categories (「개별 지정」) first, then the
 * mappings (CategoryMapping, backend 44 · FEATURE_2610_12 / D41).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * Assign = miller-columns tree drill-down (shared CategoryTreeColumns, same as the create form). Picking a
 * leaf first checks that leaf's categories: if 11st (always) or a switched-on Coupang has none, the
 * 「플랫폼 카테고리 선택」 popup opens, and the assignment runs when it closes (pick or skip — FEATURE_2610_11 /
 * D8 · FEATURE_2610_12 / D35). Its 「개별 지정」 picks are saved after the assignment (D53). Otherwise
 * setCategory runs immediately. Below the category, one line per platform (`PlatformCategoryRows`, D50):
 * [변경] → picker → 「적용 범위 선택」 → own row or mapping; [기준으로 되돌리기] deletes the own row.
 * There is no [해제] — an assigned standard category can be replaced, not removed (D49).
 *
 * ⚠️ The category is also the input of sibling sections (category meta, option inheritance) → every change
 * is reported to the parent through `onCategoryChanged` / `onPlatformCategoryChanged`. The parent re-reads only
 * what depends on it (category meta · mappings · own rows · channel rows) — it **never reloads the whole
 * detail** (83A rule).
 *
 * ⚠️ This panel is a **sub-block inside** the [상품 기본 정보] tab (user request 2026-08-29) → it draws no
 * card shell (rounded/shadow) of its own and uses the same `border-t + p-4` · `<h3>` as its sibling blocks
 * (options · images). Do not turn it back into a standalone section.
 */
export function MasterCategoryPanel({
  masterId,
  useCase,
  categoryUseCase,
  mappingUseCase,
  onCategoryChanged,
  lookupUseCase,
  activePlatforms,
  mappingsVersion,
  onPlatformCategoryChanged,
}: MasterCategoryPanelProps) {
  const [current, setCurrent] = useState<MasterCategoryResponse | null>(null);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  // The master's own platform categories (「개별 지정」, D40).
  const [owns, setOwns] = useState<MasterPlatformCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Whether the tree drilldown is expanded for (re)assigning the standard category.
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Leaf waiting for the missing-platform popup to close (null = popup closed).
  const [pendingLeaf, setPendingLeaf] = useState<{
    leaf: CategoryTreeNode;
    platforms: LookupPlatform[];
  } | null>(null);
  // [변경] → picker platform, then the pick waiting for 「적용 범위 선택」 (D51).
  const [pickerPlatform, setPickerPlatform] = useState<LookupPlatform | null>(null);
  const [scopePick, setScopePick] = useState<{ platform: LookupPlatform; sel: PickerSelection } | null>(null);

  // Stable browse reference so CategoryTreeColumns' mount effect doesn't re-run every render.
  const browseTree = useCallback(
    (parentId?: number) => categoryUseCase.browseTree(parentId),
    [categoryUseCase],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const cat = await useCase.getCategory(masterId);
      setCurrent(cat);
      if (cat) {
        const [m, o] = await Promise.all([
          mappingUseCase.getMappings(cat.categoryId).catch(() => []),
          useCase.getPlatformCategories(masterId).catch(() => []),
        ]);
        setMappings(m);
        setOwns(o);
      } else {
        setMappings([]);
        setOwns([]);
      }
    } catch (e) {
      setError(extractErrorMessage(e, '표준 카테고리를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [useCase, mappingUseCase, masterId]);

  // `mappingsVersion` re-runs the load after a mapping save made by the parent (D11).
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, mappingsVersion]);

  // Assign the leaf to this master, save the popup's 「개별 지정」 picks (after — D53), then reload.
  // ⚠️ A failed own-pick save is shown after `load()` — `load()` clears the banner first.
  const assignLeaf = async (leaf: CategoryTreeNode, ownPicks: MasterPlatformCategoryRequest[]) => {
    setIsSaving(true);
    setError('');
    try {
      const next = await useCase.setCategory(masterId, { categoryId: leaf.id });
      let ownError = '';
      try {
        for (const pick of ownPicks) {
          await useCase.setPlatformCategory(masterId, pick);
        }
      } catch (e) {
        ownError = extractErrorMessage(e, '개별 지정 저장에 실패했습니다.');
      }
      setIsTreeOpen(false);
      await load();
      if (ownError) setError(ownError);
      onCategoryChanged?.(next);
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리 지정에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Leaf picked in the tree → ask for missing platform categories first (D8), then assign.
  // A failed mapping read asks nothing and assigns right away. Re-picking the current leaf keeps the own rows
  // (D53), so they count as present there.
  const handleSelectLeaf = async (leaf: CategoryTreeNode) => {
    setIsSaving(true);
    const leafMappings = await mappingUseCase.getMappings(leaf.id).catch(() => null);
    setIsSaving(false);
    const present = leafMappings
      ? [...leafMappings, ...(leaf.id === current?.categoryId ? owns : [])]
      : null;
    const missing = present ? missingPlatformsOf(promptPlatformsOf(activePlatforms), present) : [];
    if (missing.length > 0) {
      setPendingLeaf({ leaf, platforms: missing });
      return;
    }
    await assignLeaf(leaf, []);
  };

  // Popup closed (picked or skipped) → continue with the assignment (D8), then its own picks (D53).
  const handleMissingClose = (ownPicks: MasterPlatformCategoryRequest[]) => {
    if (!pendingLeaf) return;
    const { leaf } = pendingLeaf;
    setPendingLeaf(null);
    void assignLeaf(leaf, ownPicks);
  };

  // A [변경] / [기준으로 되돌리기] write: run it, then reload this panel and tell the parent (D50).
  const runPlatformCategoryChange = async (write: () => Promise<unknown>, fallback: string) => {
    setIsSaving(true);
    setError('');
    try {
      await write();
      await load();
      onPlatformCategoryChanged();
    } catch (e) {
      setError(extractErrorMessage(e, fallback));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePicked = (platform: LookupPlatform, sel: PickerSelection) => {
    setPickerPlatform(null);
    setScopePick({ platform, sel });
  };

  // [이 상품만 개별 지정] (D51) — the master's own row.
  const handleOwn = () => {
    if (!scopePick) return;
    const { platform, sel } = scopePick;
    setScopePick(null);
    void runPlatformCategoryChange(
      () =>
        useCase.setPlatformCategory(masterId, {
          platform,
          platformCategoryId: sel.platformCategoryId,
          platformCategoryName: sel.namePath || sel.name,
        }),
      '개별 지정 저장에 실패했습니다.',
    );
  };

  // [기준 카테고리 연결을 바꾸기] (D51) — the standard category's mapping (every master using it).
  const handleBase = () => {
    if (!scopePick || !current) return;
    const { platform, sel } = scopePick;
    setScopePick(null);
    void runPlatformCategoryChange(
      () =>
        mappingUseCase.upsertMapping(current.categoryId, {
          platform,
          platformCategoryId: sel.platformCategoryId,
          platformCategoryName: sel.namePath || sel.name,
        }),
      '매핑 저장에 실패했습니다.',
    );
  };

  // [기준으로 되돌리기] (D44) — delete the own row; nothing else is cleared (D47).
  const handleRevert = (platform: LookupPlatform) => {
    void runPlatformCategoryChange(
      () => useCase.deletePlatformCategory(masterId, platform),
      '기준으로 되돌리기에 실패했습니다.',
    );
  };

  const busy = isSaving;

  // 테두리·제목을 스스로 그리지 않는다 — 「상품 기본 정보」 탭의 `StackedBlock` 이 제목을, `divide-y` 가 선을 긋는다.
  // 🔴 `border-t` 나 `<h3>표준 카테고리` 를 되살리지 말 것 — 선이 두 번, 제목이 두 번 보인다.
  return (
    <div className="p-4">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : current ? (
        <div className="mb-3 space-y-2">
          <p className="text-sm text-gray-900">
            현재 표준 카테고리: <span className="font-medium">{current.categoryName}</span>
          </p>
          {mappings.length === 0 && (
            <p className="text-xs text-amber-700">
              몰 매핑이 없습니다 — 해당 채널 등록 시 매핑이 필요합니다.{' '}
              <Link href={ROUTES.COSTS_CATEGORY} className="underline">
                카테고리 관리에서 매핑
              </Link>
            </p>
          )}
          <PlatformCategoryRows
            rows={platformCategoryRowsOf(mappings, owns)}
            onChange={setPickerPlatform}
            onRevert={handleRevert}
            disabled={busy}
          />
        </div>
      ) : (
        <p className="mb-3 text-sm text-gray-500">
          표준 카테고리 미설정 — 채널 등록 전 지정이 필요합니다.
        </p>
      )}

      {!isLoading && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTreeOpen((v) => !v)}
              disabled={busy}
              className="rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {isTreeOpen ? '트리 닫기' : current ? '카테고리 변경' : '카테고리 지정'}
            </button>
            {isSaving && <Spinner size={16} label="저장 중..." />}
          </div>

          {isTreeOpen && (
            <div className="space-y-1">
              <CategoryTreeColumns
                browse={browseTree}
                selectedId={current?.categoryId ?? null}
                onSelectLeaf={(leaf) => void handleSelectLeaf(leaf)}
              />
              <p className="text-[11px] text-gray-500">
                세부(leaf) 카테고리를 선택하면 즉시 지정됩니다. 카테고리가 없으면{' '}
                <Link href={ROUTES.COSTS_CATEGORY} className="text-blue-600 hover:underline">
                  카테고리 관리
                </Link>
                에서 import·추가하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {pendingLeaf && (
        <MissingPlatformCategoryModal
          categoryId={pendingLeaf.leaf.id}
          categoryName={pendingLeaf.leaf.name}
          platforms={pendingLeaf.platforms}
          mappingUseCase={mappingUseCase}
          lookupUseCase={lookupUseCase}
          onClose={handleMissingClose}
        />
      )}

      {pickerPlatform && (
        <CategoryLookupPickerModal
          open={pickerPlatform !== null}
          platform={pickerPlatform}
          lookupUseCase={lookupUseCase}
          onSelect={(sel) => handlePicked(pickerPlatform, sel)}
          onClose={() => setPickerPlatform(null)}
        />
      )}

      {scopePick && (
        <CategoryScopeDialog
          platform={scopePick.platform}
          path={scopePick.sel.namePath || scopePick.sel.name}
          onOwn={handleOwn}
          onBase={handleBase}
          onCancel={() => setScopePick(null)}
        />
      )}
    </div>
  );
}
