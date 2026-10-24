'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/** A tree node. The id is the standard category id (number) or a marketplace code (string). */
export interface TreeNode<TId extends string | number> {
  id: TId;
  name: string;
  leaf: boolean;
}

/**
 * Category tree as miller columns (Finder column view). Appends each parent's children as a column and is browsed
 * left → right; a leaf click confirms the pick.
 *
 * Reused by the master **create form** and the standard category **management screen** (do not build a second one).
 *
 * @example
 * const browseTree = useCallback((pid?: number) => categoryUseCase.browseTree(pid), [categoryUseCase]);
 * <CategoryTreeColumns
 *   browse={browseTree}
 *   selectedId={selectedCategoryId === '' ? null : selectedCategoryId}
 *   onSelectLeaf={(leaf) => { setSelectedCategoryId(leaf.id); setSelectedCategoryName(leaf.name); }}
 * />
 *
 * ⚠️ Required rules:
 * - The parent injects `browse` (`categoryUseCase.browseTree`). Do not create a new use case inside the component.
 *   Pass a stable reference wrapped in `useCallback` in the parent to avoid an endless re-mount loop.
 * - Keep nodes thin (id/name/leaf) — mapping badges and parent info are not on the node; on a leaf pick the parent
 *   (the management screen's right panel) fetches them separately.
 * - `onSelectLeaf` fires on leaves only (a non-leaf only drills down).
 * - `expandTo` (optional) = the root→…→target ancestor id chain. When given, the columns open along that path to
 *   show the target (used to trace a search result back in the tree). The columns are rebuilt whenever it changes.
 *
 * ⚠️ Below 768px (FEATURE_2610_31 D36): only the last column is drawn, as wide as the tree, with a path row above
 *   it — 「전체 › {step} › …」. 「전체」 goes back to the first column; a step goes back to that step's children
 *   column (same rule as the app's `category_tree_list.dart`). A step is listed while its children column is open.
 *   CSS only (`max-md:` classes) — the column state is the same at every width.
 *
 * ⚠️ Adding a category (management screen only, optional):
 * - With `addMode` + `onCreateCategory`, **a `+ 여기에 추가` button at the top of each column (= layer)** appears.
 *   It creates a category under that column's parent (= the column's `parentId`); the root column = add at the top.
 * - In `addMode` a leaf click opens an empty child column so a **first child** can be added under that leaf
 *   (a leaf turns non-leaf once it has a child → no longer a product pick).
 * - `onCreateCategory(parentId, name)` does the real create (+ search cache invalidation) in the parent. After
 *   success the component reloads only that column (and its parent column) to show the new node (no full remount
 *   → the position stays).
 * - Both props are optional → existing callers that do not pass them (the create form etc.) get no `+` UI.
 *
 * ⚠️ The id type (`TId`) is inferred from `browse` — standard category = number, the market category picker =
 * market code string (`CategoryLookupPickerModal`). The value is not interpreted, only handed back to `browse`.
 */
interface CategoryTreeColumnsProps<TId extends string | number> {
  browse: (parentId?: TId) => Promise<TreeNode<TId>[]>;
  onSelectLeaf: (leaf: TreeNode<TId>, path: TreeNode<TId>[]) => void;
  selectedId?: TId | null;
  expandTo?: TId[] | null;
  addMode?: boolean;
  onCreateCategory?: (parentId: TId | undefined, name: string) => Promise<void>;
}

type Column<TId extends string | number> = {
  parentId?: TId;
  nodes: TreeNode<TId>[];
  loading: boolean;
  error: string | null;
};

function errorColumn<TId extends string | number>(parentId: TId | undefined, e: unknown): Column<TId> {
  return {
    parentId,
    nodes: [],
    loading: false,
    error: extractErrorMessage(e, '카테고리 조회에 실패했습니다.'),
  };
}

export function CategoryTreeColumns<TId extends string | number = number>({
  browse,
  onSelectLeaf,
  selectedId,
  expandTo,
  addMode,
  onCreateCategory,
}: CategoryTreeColumnsProps<TId>) {
  // Initial state = root column in a loading state (so the spinner shows before the first
  // browse resolves without a synchronous setState in the effect).
  const [columns, setColumns] = useState<Column<TId>[]>([
    { parentId: undefined, nodes: [], loading: true, error: null },
  ]); // 좌→우 컬럼 순서
  const [path, setPath] = useState<TreeNode<TId>[]>([]); // 선택 경로(대표→…→현재)
  // The horizontal column strip (overflow-x-auto), scrolled right to reveal a newly appended column.
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The rendered button of the currently-selected node, scrolled into view (horizontal
  // columns + per-column vertical scroll) so an expanded/selected target is actually visible.
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // Inline "add category" input state (management screen only). addingCol = which column's
  // `+` input is currently open; null = none open.
  const [addingCol, setAddingCol] = useState<number | null>(null);
  const [addName, setAddName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Load the root column, or — when expandTo is given — rebuild columns along that ancestor
  // chain so the target is revealed. Inline async IIFE avoids set-state-in-effect lint.
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (expandTo && expandTo.length > 0) {
        try {
          const cols: Column<TId>[] = [];
          const pathNodes: TreeNode<TId>[] = [];
          let parent: TId | undefined = undefined;
          for (let level = 0; level < expandTo.length; level++) {
            const nodes = await browse(parent);
            cols.push({ parentId: parent, nodes, loading: false, error: null });
            const node = nodes.find((n) => n.id === expandTo[level]);
            if (!node) break; // chain inconsistent with the current tree — stop where we can
            pathNodes.push(node);
            if (node.leaf) break;
            parent = node.id;
          }
          // If the target is a non-leaf, also show its children column.
          const last = pathNodes[pathNodes.length - 1];
          if (last && !last.leaf) {
            const children = await browse(last.id);
            cols.push({ parentId: last.id, nodes: children, loading: false, error: null });
          }
          if (alive) {
            setColumns(cols.length > 0 ? cols : [{ parentId: undefined, nodes: [], loading: false, error: null }]);
            setPath(pathNodes);
          }
        } catch (e) {
          if (alive) setColumns([errorColumn<TId>(undefined, e)]);
        }
        return;
      }
      // Default: load the root column only.
      try {
        const nodes = await browse(undefined);
        if (alive) setColumns([{ parentId: undefined, nodes, loading: false, error: null }]);
      } catch (e) {
        if (alive) setColumns([errorColumn<TId>(undefined, e)]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [browse, expandTo]);

  const handleNodeClick = async (col: number, node: TreeNode<TId>) => {
    // Navigating cancels any open add-input.
    setAddingCol(null);
    // Truncate the path/columns to the right of the clicked column, then set this node.
    setPath((prev) => [...prev.slice(0, col), node]);
    const nextPath = [...path.slice(0, col), node];

    if (node.leaf) {
      // In add-mode, reveal an empty child column so the first child can be added under a leaf.
      setColumns((prev) =>
        addMode
          ? [...prev.slice(0, col + 1), { parentId: node.id, nodes: [], loading: false, error: null }]
          : prev.slice(0, col + 1)
      );
      onSelectLeaf(node, nextPath);
      return;
    }

    // Non-leaf: append a loading placeholder child column, then replace with results/error.
    setColumns((prev) => [
      ...prev.slice(0, col + 1),
      { parentId: node.id, nodes: [], loading: true, error: null },
    ]);
    try {
      const nodes = await browse(node.id);
      setColumns((prev) => [
        ...prev.slice(0, col + 1),
        { parentId: node.id, nodes, loading: false, error: null },
      ]);
    } catch (e) {
      const msg = extractErrorMessage(e, '카테고리 조회에 실패했습니다.');
      setColumns((prev) => [
        ...prev.slice(0, col + 1),
        { parentId: node.id, nodes: [], loading: false, error: msg },
      ]);
    }
  };

  const startAdd = (col: number) => {
    setAddingCol(col);
    setAddName('');
    setAddError(null);
  };

  const cancelAdd = () => {
    setAddingCol(null);
    setAddName('');
    setAddError(null);
  };

  const submitAdd = async (col: number) => {
    const name = addName.trim();
    if (!name || !onCreateCategory) return;
    const parentId = columns[col].parentId;
    const parentColParentId = col > 0 ? columns[col - 1].parentId : undefined;
    setAddBusy(true);
    setAddError(null);
    try {
      await onCreateCategory(parentId, name);
      // Refresh this column (show the new node) + the parent column (a leaf parent may have
      // just become non-leaf, so its leaf marker needs updating).
      const targetNodes = await browse(parentId);
      const parentNodes = col > 0 ? await browse(parentColParentId) : null;
      setColumns((prev) =>
        prev.map((c, i) => {
          if (i === col) return { ...c, nodes: targetNodes, loading: false, error: null };
          if (i === col - 1 && parentNodes) return { ...c, nodes: parentNodes, loading: false, error: null };
          return c;
        })
      );
      setAddingCol(null);
      setAddName('');
    } catch (e) {
      setAddError(extractErrorMessage(e, '카테고리 생성에 실패했습니다.'));
    } finally {
      setAddBusy(false);
    }
  };

  // After columns render, keep the active edge visible. If a node is selected and rendered,
  // bring it into view; otherwise (e.g. drilling into a non-leaf, which selects nothing yet)
  // scroll the strip fully right so the newly appended column is revealed. Not setState → safe.
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      const container = containerRef.current;
      container?.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    }
  }, [columns, selectedId]);

  // Path row below 768px: 「전체」 = the first column only; step i = show the children column of path[i] (D36).
  const goRoot = () => {
    setAddingCol(null);
    setColumns((prev) => prev.slice(0, 1));
    setPath([]);
  };
  const goStep = (i: number) => {
    setAddingCol(null);
    setColumns((prev) => prev.slice(0, i + 2));
    setPath((prev) => prev.slice(0, i + 1));
  };

  const canAdd = Boolean(addMode && onCreateCategory);
  const lastCol = columns.length - 1;

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 max-md:flex-col"
    >
      <nav aria-label="카테고리 경로" className="flex flex-wrap items-center gap-1 text-sm md:hidden">
        <button type="button" onClick={goRoot} className="rounded px-1 text-gray-900 hover:bg-gray-100">
          전체
        </button>
        {path.map((node, i) =>
          i + 1 <= lastCol ? (
            <span key={String(node.id)} className="flex items-center gap-1">
              <span className="text-gray-500">›</span>
              <button
                type="button"
                onClick={() => goStep(i)}
                className="rounded px-1 text-gray-900 hover:bg-gray-100"
              >
                {node.name}
              </button>
            </span>
          ) : null
        )}
      </nav>
      {columns.map((column, col) => (
        <div
          key={col}
          className={`min-w-[200px] shrink-0 rounded border border-gray-200 bg-white ${
            col === lastCol ? 'max-md:w-full max-md:min-w-0' : 'max-md:hidden'
          }`}
        >
          {/* Add-category row at the top of each layer (management screen, add-mode). */}
          {canAdd && !column.loading && (
            <div className="border-b border-gray-100 p-1.5">
              {addingCol === col ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && addName.trim() && !addBusy) void submitAdd(col);
                      if (e.key === 'Escape' && !addBusy) cancelAdd();
                    }}
                    placeholder="새 카테고리 이름"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-1 max-md:flex-wrap">
                    <button
                      type="button"
                      onClick={() => void submitAdd(col)}
                      disabled={!addName.trim() || addBusy}
                      className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {addBusy ? <Spinner size={14} label="저장" /> : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelAdd}
                      disabled={addBusy}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                  {addError && <p className="text-xs text-red-700">{addError}</p>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startAdd(col)}
                  className="w-full rounded px-2 py-1 text-left text-xs font-medium text-green-700 hover:bg-green-50"
                >
                  + {col === 0 ? '최상위에 추가' : '여기에 추가'}
                </button>
              )}
            </div>
          )}

          {column.loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size={20} />
            </div>
          ) : column.error ? (
            <p className="m-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{column.error}</p>
          ) : column.nodes.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">
              {col === 0 ? '카테고리가 없습니다.' : '하위 카테고리가 없습니다.'}
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
              {column.nodes.map((node) => {
                const onPath = path[col]?.id === node.id;
                const isSelected = selectedId != null && node.id === selectedId;
                const isSelectedLeaf = node.leaf && isSelected;
                return (
                  <li key={node.id}>
                    <button
                      ref={isSelected ? selectedRef : null}
                      type="button"
                      onClick={() => void handleNodeClick(col, node)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        isSelectedLeaf
                          ? 'bg-blue-50 font-medium text-blue-700'
                          : onPath
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-800'
                      }`}
                    >
                      <span className="truncate">{node.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-gray-400">
                        {node.leaf ? '선택' : '›'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
