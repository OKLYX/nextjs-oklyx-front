'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { MasterCategoryResponse } from '@/domain/entities/MasterProductEntity';
import type { CategoryTreeNode } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import { MissingPlatformCategoryModal } from '../../components/MissingPlatformCategoryModal';
import {
  lookupPlatformLabel,
  missingPlatformsOf,
  type LookupPlatform,
} from '../../components/platformCategory';

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
  mappingUseCase: CategoryMappingUseCase;
  // 지정/해제 결과를 부모 컨테이너에 통지 → 형제 섹션(카테고리 메타·옵션)이 새 카테고리 기준으로 바뀐다.
  // 지정 = setCategory 응답 그대로, 해제 = null. 패널은 계속 자기 표시 상태를 스스로 들고 있다.
  onCategoryChanged?: (next: MasterCategoryResponse | null) => void;
  /** Parent-owned lookup use case — the missing-platform popup opens the shared picker with it. */
  lookupUseCase: CategoryLookupUseCase;
  /** Lookup platforms with a switched-on account (D17). Empty = none / not loaded / failed → nothing is asked. */
  activePlatforms: LookupPlatform[];
  /** Bumped by the parent after a mapping save elsewhere on the page → this panel re-reads (D11). */
  mappingsVersion: number;
  /** [카테고리 선택하기] on a missing-platform line — the parent opens the picker and saves (D21 ③). */
  onPickPlatformCategory: (platform: LookupPlatform) => void;
}

/**
 * Standard category assignment panel (master detail). A master points at one standard category;
 * per-mall marketplace codes are resolved by the mappings (CategoryMapping, backend 44).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * Assign = miller-columns tree drill-down (shared CategoryTreeColumns, same as the create form). Picking a
 * leaf first checks that leaf's mappings: if a switched-on platform (Coupang · 11st) has none, the
 * 「플랫폼 카테고리 선택」 popup opens, and the assignment runs when it closes (pick or skip — FEATURE_2610_11 / D8).
 * Otherwise setCategory runs immediately. Badges stay read-only; a platform missing a mapping gets a
 * 「{플랫폼} 카테고리 없음」 line + [카테고리 선택하기], which the parent handles (D23).
 *
 * ⚠️ The category is also the input of sibling sections (category meta, option inheritance) → every change
 * is reported to the parent through `onCategoryChanged`. The parent swaps that value and re-reads only what
 * depends on it (category meta · mappings · channel rows) — it **never reloads the whole detail** (83A rule).
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
  onPickPlatformCategory,
}: MasterCategoryPanelProps) {
  const [current, setCurrent] = useState<MasterCategoryResponse | null>(null);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Whether the tree drilldown is expanded for (re)assigning the standard category.
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // Leaf waiting for the missing-platform popup to close (null = popup closed).
  const [pendingLeaf, setPendingLeaf] = useState<{
    leaf: CategoryTreeNode;
    platforms: LookupPlatform[];
  } | null>(null);

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
        const m = await mappingUseCase.getMappings(cat.categoryId).catch(() => []);
        setMappings(m);
      } else {
        setMappings([]);
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

  // Assign the leaf to this master, then reload.
  const assignLeaf = async (leaf: CategoryTreeNode) => {
    setIsSaving(true);
    setError('');
    try {
      const next = await useCase.setCategory(masterId, { categoryId: leaf.id });
      setIsTreeOpen(false);
      await load();
      onCategoryChanged?.(next);
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리 지정에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Leaf picked in the tree → ask for missing platform categories first (D8), then assign.
  // A failed mapping read asks nothing and assigns right away.
  const handleSelectLeaf = async (leaf: CategoryTreeNode) => {
    if (activePlatforms.length > 0) {
      setIsSaving(true);
      const leafMappings = await mappingUseCase.getMappings(leaf.id).catch(() => null);
      setIsSaving(false);
      const missing = leafMappings ? missingPlatformsOf(activePlatforms, leafMappings) : [];
      if (missing.length > 0) {
        setPendingLeaf({ leaf, platforms: missing });
        return;
      }
    }
    await assignLeaf(leaf);
  };

  // Popup closed (picked or skipped) → continue with the assignment (D8).
  const handleMissingClose = () => {
    if (!pendingLeaf) return;
    const { leaf } = pendingLeaf;
    setPendingLeaf(null);
    void assignLeaf(leaf);
  };

  const handleClear = async () => {
    if (!window.confirm('표준 카테고리 지정을 해제하시겠습니까?')) return;
    setIsClearing(true);
    setError('');
    try {
      await useCase.clearCategory(masterId);
      await load();
      onCategoryChanged?.(null);
    } catch (e) {
      setError(extractErrorMessage(e, '해제에 실패했습니다.'));
    } finally {
      setIsClearing(false);
    }
  };

  const busy = isSaving || isClearing;
  const missingPlatforms = current ? missingPlatformsOf(activePlatforms, mappings) : [];

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
          {mappings.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {mappings.map((m) => (
                <span
                  key={m.platform}
                  className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                >
                  {m.platform} ✓
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              몰 매핑이 없습니다 — 해당 채널 등록 시 매핑이 필요합니다.{' '}
              <Link href={ROUTES.COSTS_CATEGORY} className="underline">
                카테고리 관리에서 매핑
              </Link>
            </p>
          )}
          {missingPlatforms.map((platform) => (
            <div key={platform} className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-amber-700">
                {`${lookupPlatformLabel(platform)} 카테고리 없음 — 올릴 수 없습니다`}
              </p>
              <button
                type="button"
                onClick={() => onPickPlatformCategory(platform)}
                disabled={busy}
                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                카테고리 선택하기
              </button>
            </div>
          ))}
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
            {current && (
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {isClearing ? <Spinner label="해제 중..." /> : '해제'}
              </button>
            )}
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
    </div>
  );
}
