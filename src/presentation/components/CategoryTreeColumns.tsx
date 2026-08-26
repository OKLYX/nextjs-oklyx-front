'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { CategoryTreeNode } from '@/domain/entities/CategoryEntity';

/**
 * 카테고리 트리 miller-columns 드릴다운(Finder 컬럼뷰). 부모별 자식을 컬럼으로
 * append 하며 좌→우로 탐색하고, leaf 클릭 시 선택을 확정한다.
 *
 * 마스터 **생성 모달**과 표준 카테고리 **관리 화면** 양쪽에서 재사용한다(중복 구현 금지).
 *
 * @example
 * const browseTree = useCallback((pid?: number) => categoryUseCase.browseTree(pid), [categoryUseCase]);
 * <CategoryTreeColumns
 *   browse={browseTree}
 *   selectedId={selectedCategoryId === '' ? null : selectedCategoryId}
 *   onSelectLeaf={(leaf) => { setSelectedCategoryId(leaf.id); setSelectedCategoryName(leaf.name); }}
 * />
 *
 * ⚠️ 필수 규칙:
 * - `browse` 는 부모가 주입한다(`categoryUseCase.browseTree`). 컴포넌트 내부에서 신규 useCase 를
 *   만들지 말 것. 재-mount 무한 루프를 피하려면 부모에서 `useCallback` 으로 감싼 안정된 참조를 넘긴다.
 * - 노드는 얇게(id/name/leaf) 유지 — 매핑 배지·부모 정보는 노드에 싣지 않고, leaf 선택 시
 *   부모(관리 화면 우측 패널)가 별도로 fetch 한다.
 * - `onSelectLeaf` 는 leaf 에서만 발화한다(비-leaf 는 드릴다운만).
 * - `expandTo`(선택) = root→…→target 조상 id 체인. 넘기면 그 경로로 컬럼을 펼쳐 target 을 노출한다
 *   (검색 결과에서 항목을 골랐을 때 트리로 되짚어 보여주는 용도). 값이 바뀔 때마다 그 경로로 재구성한다.
 *
 * ⚠️ 카테고리 추가(관리 화면 전용, optional):
 * - `addMode` + `onCreateCategory` 를 함께 넘기면 **각 컬럼(=layer) 최상단에 `+ 여기에 추가` 버튼**이
 *   뜬다. 그 컬럼의 부모(=컬럼의 `parentId`) 밑에 새 카테고리를 만든다(root 컬럼 = 최상위 추가).
 * - `addMode` 에서 leaf 를 클릭하면 빈 자식 컬럼이 펼쳐져 그 leaf 밑에 **첫 자식**도 추가할 수 있다
 *   (leaf 는 자식이 생기면 비-leaf 로 전환 → 상품 선택 대상에서 빠짐).
 * - `onCreateCategory(parentId, name)` 는 부모가 실제 생성(+검색 캐시 무효화)을 담당한다. 성공 후
 *   컴포넌트가 해당 컬럼(과 부모 컬럼)만 재조회해 새 노드를 보여준다(전체 remount 안 함 → 위치 보존).
 * - 두 prop 모두 optional → 넘기지 않는 기존 사용처(생성 모달 등)엔 `+` UI 가 없다.
 */
interface CategoryTreeColumnsProps {
  browse: (parentId?: number) => Promise<CategoryTreeNode[]>;
  onSelectLeaf: (leaf: CategoryTreeNode, path: CategoryTreeNode[]) => void;
  selectedId?: number | null;
  expandTo?: number[] | null;
  addMode?: boolean;
  onCreateCategory?: (parentId: number | undefined, name: string) => Promise<void>;
}

type Column = {
  parentId?: number;
  nodes: CategoryTreeNode[];
  loading: boolean;
  error: string | null;
};

export function CategoryTreeColumns({
  browse,
  onSelectLeaf,
  selectedId,
  expandTo,
  addMode,
  onCreateCategory,
}: CategoryTreeColumnsProps) {
  // Initial state = root column in a loading state (so the spinner shows before the first
  // browse resolves without a synchronous setState in the effect).
  const [columns, setColumns] = useState<Column[]>([
    { parentId: undefined, nodes: [], loading: true, error: null },
  ]); // 좌→우 컬럼 순서
  const [path, setPath] = useState<CategoryTreeNode[]>([]); // 선택 경로(대표→…→현재)
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

  const errorColumn = (parentId: number | undefined, e: unknown): Column => ({
    parentId,
    nodes: [],
    loading: false,
    error: extractErrorMessage(e, '카테고리 조회에 실패했습니다.'),
  });

  // Load the root column, or — when expandTo is given — rebuild columns along that ancestor
  // chain so the target is revealed. Inline async IIFE avoids set-state-in-effect lint.
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (expandTo && expandTo.length > 0) {
        try {
          const cols: Column[] = [];
          const pathNodes: CategoryTreeNode[] = [];
          let parent: number | undefined = undefined;
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
          if (alive) setColumns([errorColumn(undefined, e)]);
        }
        return;
      }
      // Default: load the root column only.
      try {
        const nodes = await browse(undefined);
        if (alive) setColumns([{ parentId: undefined, nodes, loading: false, error: null }]);
      } catch (e) {
        if (alive) setColumns([errorColumn(undefined, e)]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [browse, expandTo]);

  const handleNodeClick = async (col: number, node: CategoryTreeNode) => {
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

  const canAdd = Boolean(addMode && onCreateCategory);

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2"
    >
      {columns.map((column, col) => (
        <div
          key={col}
          className="min-w-[200px] shrink-0 rounded border border-gray-200 bg-white"
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
                  <div className="flex gap-1">
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
