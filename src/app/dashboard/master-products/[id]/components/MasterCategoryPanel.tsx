'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryLookupPickerModal } from '@/app/dashboard/costs/category/components/CategoryLookupPickerModal';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { MasterCategoryResponse } from '@/domain/entities/MasterProductEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
  mappingUseCase: CategoryMappingUseCase;
  lookupUseCase: CategoryLookupUseCase;
}

/**
 * 표준 카테고리 지정 패널 (마스터 상세). 마스터는 표준 카테고리 하나만 지정하고,
 * 몰별 마켓 코드는 매핑(CategoryMapping)이 해석한다 (백엔드 44).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * 지정 방식 2택: (1) 기존 표준 선택 (2) 조회 피커로 새 표준 즉시 생성.
 * 몰별 매핑 배지는 읽기 전용 — 매핑 채우기는 F1 카테고리 관리 화면으로 유도.
 */
export function MasterCategoryPanel({
  masterId,
  useCase,
  categoryUseCase,
  mappingUseCase,
  lookupUseCase,
}: MasterCategoryPanelProps) {
  const [current, setCurrent] = useState<MasterCategoryResponse | null>(null);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 'existing' shows the inline select for picking an already-created standard category.
  const [action, setAction] = useState<'none' | 'existing'>('none');
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleChooseExisting = async () => {
    setAction('existing');
    setError('');
    if (categories.length === 0) {
      setCatsLoading(true);
      try {
        setCategories(await categoryUseCase.getCategories());
      } catch (e) {
        setError(extractErrorMessage(e, '표준 카테고리 목록을 불러오지 못했습니다.'));
      } finally {
        setCatsLoading(false);
      }
    }
  };

  const handleSaveExisting = async () => {
    if (selectedCategoryId === '') return;
    setIsSaving(true);
    setError('');
    try {
      await useCase.setCategory(masterId, { categoryId: Number(selectedCategoryId) });
      setAction('none');
      setSelectedCategoryId('');
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리 지정에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  // New standard from the lookup picker: create the standard category, seed its COUPANG
  // mapping (F1 flow), then assign it to this master. Backend create still requires
  // platform/code, so send the picker's selection with it (F1 §deviation).
  const handleCreateFromPicker = async (sel: {
    platformCategoryId: string;
    name: string;
    namePath: string;
  }) => {
    setIsCreating(true);
    setError('');
    try {
      const created = await categoryUseCase.createCategory({
        name: sel.name,
        platform: 'COUPANG',
        platformCategoryId: sel.platformCategoryId,
        parentId: null,
      });
      await mappingUseCase.upsertMapping(created.id, {
        platform: 'COUPANG',
        platformCategoryId: sel.platformCategoryId,
        platformCategoryName: sel.namePath || sel.name,
      });
      await useCase.setCategory(masterId, { categoryId: created.id });
      setIsPickerOpen(false);
      setAction('none');
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '새 표준 카테고리 생성에 실패했습니다.'));
    } finally {
      setIsCreating(false);
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

  const busy = isSaving || isCreating || isClearing;

  return (
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
        <div className="flex flex-wrap items-end gap-2">
          {action === 'existing' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">표준 카테고리</label>
                <select
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')}
                  disabled={catsLoading || isSaving}
                >
                  <option value="">{catsLoading ? '불러오는 중...' : '선택'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleSaveExisting}
                disabled={isSaving || selectedCategoryId === ''}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <Spinner label="저장 중..." /> : '저장'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAction('none');
                  setSelectedCategoryId('');
                }}
                disabled={isSaving}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleChooseExisting}
                disabled={busy}
                className="rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {current ? '기존 표준으로 변경' : '기존 표준 선택'}
              </button>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                disabled={busy}
                className="rounded border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                {isCreating ? <Spinner label="생성 중..." /> : '새 표준 만들기'}
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
            </>
          )}
        </div>
      )}

      {isPickerOpen && (
        <CategoryLookupPickerModal
          open={isPickerOpen}
          platform="COUPANG"
          lookupUseCase={lookupUseCase}
          onSelect={(sel) => void handleCreateFromPicker(sel)}
          onClose={() => {
            if (!isCreating) setIsPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
