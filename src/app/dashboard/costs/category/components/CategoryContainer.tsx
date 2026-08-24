'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import { CategoryMappingRepositoryImpl } from '@/infrastructure/repositories/CategoryMappingRepositoryImpl';
import { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import { CategoryLookupRepositoryImpl } from '@/infrastructure/repositories/CategoryLookupRepositoryImpl';
import { CategoryTable } from './CategoryTable';
import { CategoryLookupPickerModal } from './CategoryLookupPickerModal';
import { CategoryMappingModal } from './CategoryMappingModal';
import { RenameCategoryModal } from './RenameCategoryModal';

/**
 * 표준 카테고리 관리 컨테이너 — 목록/생성(조회 피커)/이름수정/몰별 매핑/삭제.
 * 3개 useCase(Category·CategoryMapping·CategoryLookup)를 소유(useMemo)해 자식에 prop 주입.
 */
export function CategoryContainer() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [categories, setCategories] = useState<Category[]>([]);
  const [mappingsByCat, setMappingsByCat] = useState<Record<number, CategoryMapping[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<Category | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const [mappingTarget, setMappingTarget] = useState<Category | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);
  const mappingUseCase = useMemo(
    () => new CategoryMappingUseCase(new CategoryMappingRepositoryImpl()),
    []
  );
  const lookupUseCase = useMemo(
    () => new CategoryLookupUseCase(new CategoryLookupRepositoryImpl()),
    []
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const cats = await categoryUseCase.getCategories();
      setCategories(cats);
      const entries = await Promise.all(
        cats.map((c) =>
          mappingUseCase
            .getMappings(c.id)
            .then((m) => [c.id, m] as [number, CategoryMapping[]])
            .catch(() => [c.id, []] as [number, CategoryMapping[]])
        )
      );
      setMappingsByCat(Object.fromEntries(entries));
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리 정보를 조회할 수 없습니다.'));
      setCategories([]);
      setMappingsByCat({});
    } finally {
      setIsLoading(false);
    }
  }, [categoryUseCase, mappingUseCase]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const reloadMappings = useCallback(
    async (categoryId: number) => {
      try {
        const m = await mappingUseCase.getMappings(categoryId);
        setMappingsByCat((prev) => ({ ...prev, [categoryId]: m }));
      } catch {
        // ignore — banner handled by the calling modal
      }
    },
    [mappingUseCase]
  );

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCreateFromPicker = async (sel: {
    platformCategoryId: string;
    name: string;
    namePath: string;
  }) => {
    setError('');
    setIsCreating(true);
    try {
      // 표준명 = 리프명. 백엔드 표준 CRUD 가 platform/코드를 요구하므로 첫 매핑값을 함께 전달.
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
      setIsAddPickerOpen(false);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '표준 카테고리 생성에 실패했습니다.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (name: string) => {
    if (!renameTarget) return;
    setIsRenaming(true);
    try {
      await categoryUseCase.updateCategory(renameTarget.id, {
        name,
        platform: renameTarget.platform,
        platformCategoryId: renameTarget.platformCategoryId,
        parentId: renameTarget.parentId ?? null,
      });
      setRenameTarget(null);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '이름 수정에 실패했습니다.'));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await categoryUseCase.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '삭제에 실패했습니다.'));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageContainer contentClassName="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">표준 카테고리</h1>
          <p className="text-gray-600">표준 카테고리를 관리하고 몰별 마켓 코드에 매핑합니다.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAddPickerOpen(true)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium whitespace-nowrap"
          >
            표준 카테고리 추가
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="표준 카테고리명 검색"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <CategoryTable
        categories={filtered}
        mappingsByCat={mappingsByCat}
        isAdmin={isAdmin}
        isLoading={isLoading}
        onRename={setRenameTarget}
        onMap={setMappingTarget}
        onDelete={setDeleteTarget}
      />

      {isAddPickerOpen && (
        <CategoryLookupPickerModal
          open={isAddPickerOpen}
          platform="COUPANG"
          lookupUseCase={lookupUseCase}
          onSelect={(sel) => void handleCreateFromPicker(sel)}
          onClose={() => {
            if (!isCreating) setIsAddPickerOpen(false);
          }}
        />
      )}

      {renameTarget && (
        <RenameCategoryModal
          open={renameTarget !== null}
          category={renameTarget}
          isSubmitting={isRenaming}
          onSubmit={handleRename}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {mappingTarget && (
        <CategoryMappingModal
          open={mappingTarget !== null}
          category={mappingTarget}
          mappings={mappingsByCat[mappingTarget.id] || []}
          mappingUseCase={mappingUseCase}
          lookupUseCase={lookupUseCase}
          onChanged={() => void reloadMappings(mappingTarget.id)}
          onClose={() => setMappingTarget(null)}
        />
      )}

      {deleteTarget && (
        <PopupDialogModal
          isOpen={deleteTarget !== null}
          title="표준 카테고리 삭제"
          message={`"${deleteTarget.name}"을(를) 삭제하시겠습니까?`}
          cancelText="취소"
          confirmText={isDeleting ? '삭제 중...' : '삭제'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isDangerous
        />
      )}
    </PageContainer>
  );
}
