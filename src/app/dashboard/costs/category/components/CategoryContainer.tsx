'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import type { Category, CategoryTreeNode } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import { CategoryMappingRepositoryImpl } from '@/infrastructure/repositories/CategoryMappingRepositoryImpl';
import { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import { CategoryLookupRepositoryImpl } from '@/infrastructure/repositories/CategoryLookupRepositoryImpl';
import { CategoryLookupPickerModal } from './CategoryLookupPickerModal';
import { CategoryMappingModal } from './CategoryMappingModal';
import { RenameCategoryModal } from './RenameCategoryModal';

// Cap how many matches are rendered/mapping-fetched per search (the imported tree is huge).
const RESULT_LIMIT = 50;

/**
 * 표준 카테고리 관리 컨테이너.
 * - 트리(CategoryTreeColumns)는 항상 고정 표시(브라우징).
 * - 목록은 **검색 전용**(import 후 수만 건이라 전체 표시·전체 매핑 fetch 금지) — 검색 결과의
 *   매핑만 lazy fetch. 검색 결과에서 항목을 고르면 트리가 그 경로로 펼쳐지고 우측 패널에서
 *   이름수정/매핑/삭제. 트리에서 직접 leaf 를 골라도 같은 패널로 이어진다.
 * 3개 useCase(Category·CategoryMapping·CategoryLookup)를 소유(useMemo)해 자식에 prop 주입.
 */
export function CategoryContainer() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [committedQuery, setCommittedQuery] = useState('');
  const [results, setResults] = useState<Category[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  // Full category list cached on first search (one call); invalidated (null) after mutations.
  const allCategoriesRef = useRef<Category[] | null>(null);

  const [mappingsByCat, setMappingsByCat] = useState<Record<number, CategoryMapping[]>>({});
  const [error, setError] = useState('');

  // Current selection (from search results OR tree leaf) → detail/action panel + tree expand.
  const [selected, setSelected] = useState<Category | null>(null);
  const [expandChain, setExpandChain] = useState<number[] | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  // Bump to remount the tree (reset to root) after a rename/delete mutates a node.
  const [treeReloadKey, setTreeReloadKey] = useState(0);

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

  // Stable browse reference so CategoryTreeColumns' effect doesn't re-run every render.
  const browseTree = useCallback(
    (parentId?: number) => categoryUseCase.browseTree(parentId),
    [categoryUseCase]
  );

  const ensureAllCategories = useCallback(async () => {
    if (allCategoriesRef.current == null) {
      allCategoriesRef.current = await categoryUseCase.getCategories();
    }
    return allCategoriesRef.current;
  }, [categoryUseCase]);

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      setError('');
      setIsSearching(true);
      try {
        const all = await ensureAllCategories();
        const lower = q.toLowerCase();
        const filtered = all.filter((c) => c.name.toLowerCase().includes(lower));
        const shown = filtered.slice(0, RESULT_LIMIT);
        // Fetch mappings only for the shown subset (bounds the request count).
        const entries = await Promise.all(
          shown.map((c) =>
            mappingUseCase
              .getMappings(c.id)
              .then((m) => [c.id, m] as [number, CategoryMapping[]])
              .catch(() => [c.id, []] as [number, CategoryMapping[]])
          )
        );
        setMappingsByCat((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setResults(shown);
        setTotalMatches(filtered.length);
        setCommittedQuery(q);
        setHasSearched(true);
      } catch (e) {
        setError(extractErrorMessage(e, '카테고리 검색에 실패했습니다.'));
        setResults([]);
        setTotalMatches(0);
      } finally {
        setIsSearching(false);
      }
    },
    [ensureAllCategories, mappingUseCase]
  );

  const handleSearch = () => {
    if (!searchInput.trim()) {
      setError('검색어를 입력하세요.');
      return;
    }
    void runSearch(searchInput);
  };

  // Build the root→…→target ancestor id chain by climbing parentId (needed to expand the tree).
  const buildChain = useCallback(
    async (cat: Category): Promise<number[]> => {
      const ids = [cat.id];
      let pid = cat.parentId ?? null;
      let guard = 0;
      while (pid != null && guard < 20) {
        ids.unshift(pid);
        const parent = await categoryUseCase.getCategoryById(pid);
        pid = parent.parentId ?? null;
        guard += 1;
      }
      return ids;
    },
    [categoryUseCase]
  );

  // Select a category (from the results list): show it in the panel + expand the tree to it.
  const handleSelectResult = useCallback(
    async (cat: Category) => {
      setSelected(cat);
      setError('');
      setPanelLoading(true);
      try {
        if (mappingsByCat[cat.id] == null) {
          const m = await mappingUseCase.getMappings(cat.id).catch(() => []);
          setMappingsByCat((prev) => ({ ...prev, [cat.id]: m }));
        }
        setExpandChain(await buildChain(cat));
      } catch (e) {
        setError(extractErrorMessage(e, '카테고리 위치를 불러오지 못했습니다.'));
      } finally {
        setPanelLoading(false);
      }
    },
    [mappingsByCat, mappingUseCase, buildChain]
  );

  // Select a leaf picked directly in the tree: load the full Category (rename/delete need
  // platform/code/parentId) + its mapping. No re-expand (the user is already there).
  const handleTreeSelectLeaf = useCallback(
    async (leaf: CategoryTreeNode) => {
      setError('');
      setPanelLoading(true);
      try {
        const full = await categoryUseCase.getCategoryById(leaf.id);
        setSelected(full);
        if (mappingsByCat[leaf.id] == null) {
          const m = await mappingUseCase.getMappings(leaf.id).catch(() => []);
          setMappingsByCat((prev) => ({ ...prev, [leaf.id]: m }));
        }
      } catch (e) {
        setError(extractErrorMessage(e, '카테고리 정보를 불러오지 못했습니다.'));
        setSelected(null);
      } finally {
        setPanelLoading(false);
      }
    },
    [categoryUseCase, mappingsByCat, mappingUseCase]
  );

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

  // After a structural change (create/rename/delete): drop the cache, reset the tree + selection,
  // and re-run the last search so the list reflects the change.
  const afterMutation = useCallback(async () => {
    allCategoriesRef.current = null;
    setSelected(null);
    setExpandChain(null);
    setTreeReloadKey((k) => k + 1);
    if (hasSearched) await runSearch(committedQuery);
  }, [hasSearched, committedQuery, runSearch]);

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
      allCategoriesRef.current = null;
      setSearchInput(created.name);
      await runSearch(created.name);
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
      await afterMutation();
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
      await afterMutation();
    } catch (e) {
      setError(extractErrorMessage(e, '삭제에 실패했습니다.'));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const isMapped = (id: number) => (mappingsByCat[id] || []).some((m) => m.platform === 'COUPANG');

  const badge = (mapped: boolean) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        mapped
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-gray-100 text-gray-400 border border-gray-200'
      }`}
    >
      쿠팡 {mapped ? '✓' : '미매핑'}
    </span>
  );

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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Search-only list */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="표준 카테고리명 검색"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
          >
            {isSearching ? <Spinner label="검색 중..." /> : '검색'}
          </button>
        </div>

        {!hasSearched ? (
          <p className="py-4 text-center text-sm text-gray-500">
            검색어를 입력해 표준 카테고리를 찾으세요. 전체 탐색은 아래 트리를 사용하세요.
          </p>
        ) : isSearching ? (
          <div className="py-6 flex justify-center">
            <Spinner size={24} />
          </div>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {totalMatches}건 중 {results.length}건 표시
              {totalMatches > results.length && ' — 더 구체적으로 검색하세요'}
            </p>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {results.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => void handleSelectResult(cat)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      selected?.id === cat.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="truncate text-gray-900">{cat.name}</span>
                    {badge(isMapped(cat.id))}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Always-visible tree (expands to the selected result) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">카테고리 트리</h2>
        <CategoryTreeColumns
          key={treeReloadKey}
          browse={browseTree}
          selectedId={selected?.id ?? null}
          expandTo={expandChain}
          onSelectLeaf={(leaf) => void handleTreeSelectLeaf(leaf)}
        />
      </div>

      {/* Selected category panel (from list or tree) */}
      <div className="bg-white rounded-lg shadow p-4">
        {panelLoading ? (
          <div className="py-6 flex justify-center">
            <Spinner size={24} />
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
              <div className="mt-2">{badge(isMapped(selected.id))}</div>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRenameTarget(selected)}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  이름수정
                </button>
                <button
                  onClick={() => setMappingTarget(selected)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  매핑
                </button>
                <button
                  onClick={() => setDeleteTarget(selected)}
                  className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            검색 결과 또는 트리에서 세부(leaf) 카테고리를 선택하면 매핑·수정·삭제를 할 수 있습니다.
          </p>
        )}
      </div>

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
