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
import type { MasterCategoryResponse } from '@/domain/entities/MasterProductEntity';
import type { CategoryTreeNode } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
  mappingUseCase: CategoryMappingUseCase;
  // 지정/해제 결과를 부모 컨테이너에 통지 → 형제 섹션(카테고리 메타·옵션)이 새 카테고리 기준으로 바뀐다.
  // 지정 = setCategory 응답 그대로, 해제 = null. 패널은 계속 자기 표시 상태를 스스로 들고 있다.
  onCategoryChanged?: (next: MasterCategoryResponse | null) => void;
}

/**
 * 표준 카테고리 지정 패널 (마스터 상세). 마스터는 표준 카테고리 하나만 지정하고,
 * 몰별 마켓 코드는 매핑(CategoryMapping)이 해석한다 (백엔드 44).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * 지정 = miller-columns 트리 드릴다운(공통 CategoryTreeColumns, 생성 모달과 동일). leaf
 * 선택 시 즉시 setCategory. 몰별 매핑 배지는 읽기 전용 — 매핑 채우기는 F1 관리 화면 유도.
 *
 * ⚠️ 카테고리는 형제 섹션(카테고리 메타·옵션 상속값)의 입력이기도 하다 → 변경 시 `onCategoryChanged`
 * 로 부모에 알린다. 부모는 그 값만 갈아끼우고 **상세 전체를 재조회하지 않는다**(83A 규칙).
 *
 * ⚠️ 이 패널은 [상품 기본 정보] 토글 **안의 하위 블록**이다(사용자 요청 2026-08-29) → 자체 카드
 * 껍데기(rounded/shadow) 없이 형제 블록(옵션·이미지)과 같은 `border-t + p-4`·`<h3>` 를 쓴다.
 * 단독 섹션으로 되돌리지 말 것.
 */
export function MasterCategoryPanel({
  masterId,
  useCase,
  categoryUseCase,
  mappingUseCase,
  onCategoryChanged,
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

  return (
    <div className="border-t border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">표준 카테고리</h3>

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
  );
}
