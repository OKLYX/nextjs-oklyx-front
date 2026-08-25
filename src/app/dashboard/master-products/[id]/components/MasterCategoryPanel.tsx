'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import { CategoryMetaPanel } from './CategoryMetaPanel';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { MasterCategoryResponse } from '@/domain/entities/MasterProductEntity';
import type { CategoryTreeNode } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
  mappingUseCase: CategoryMappingUseCase;
}

/**
 * 표준 카테고리 지정 패널 (마스터 상세). 마스터는 표준 카테고리 하나만 지정하고,
 * 몰별 마켓 코드는 매핑(CategoryMapping)이 해석한다 (백엔드 44).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * 지정 = miller-columns 트리 드릴다운(공통 CategoryTreeColumns, 생성 모달과 동일). leaf
 * 선택 시 즉시 setCategory. 몰별 매핑 배지는 읽기 전용 — 매핑 채우기는 F1 관리 화면 유도.
 */
export function MasterCategoryPanel({
  masterId,
  useCase,
  categoryUseCase,
  mappingUseCase,
}: MasterCategoryPanelProps) {
  const [current, setCurrent] = useState<MasterCategoryResponse | null>(null);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Whether the tree drilldown is expanded for (re)assigning the standard category.
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Leaf picked in the tree → assign it to this master immediately, then reload.
  const handleSelectLeaf = async (leaf: CategoryTreeNode) => {
    setIsSaving(true);
    setError('');
    try {
      await useCase.setCategory(masterId, { categoryId: leaf.id });
      setIsTreeOpen(false);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리 지정에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('표준 카테고리 지정을 해제하시겠습니까?')) return;
    setIsClearing(true);
    setError('');
    try {
      await useCase.clearCategory(masterId);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '해제에 실패했습니다.'));
    } finally {
      setIsClearing(false);
    }
  };

  const busy = isSaving || isClearing;

  return (
    <>
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">표준 카테고리</h2>

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
    </div>

      {/* Category required-attributes / notices (backend 47). Renders only once a
          standard category is assigned and the resolved schema is non-empty. */}
      <CategoryMetaPanel masterId={masterId} categoryCode={current ? String(current.categoryId) : null} />
    </>
  );
}
