'use client';

import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { CategoryNode } from '@/domain/entities/CategoryLookupEntity';

/**
 * 마켓 카테고리 조회 피커(트리 드릴다운 + 상품명 추천) — 코드 손타이핑 없이 선택.
 *
 * hand-rolled `fixed inset-0` 모달(shadcn 미도입). useCase 는 **부모 인스턴스 재사용**
 * (모달 내 신규 생성 금지). 선택 확정 시 `onSelect({platformCategoryId, name, namePath})`.
 * 조회 실패(활성 계정 없음/500)는 피커 내 인라인 배너로 표시.
 */
interface CategoryLookupPickerModalProps {
  open: boolean;
  platform: 'COUPANG' | 'NAVER';
  lookupUseCase: CategoryLookupUseCase;
  onSelect: (sel: { platformCategoryId: string; name: string; namePath: string }) => void;
  onClose: () => void;
}

interface Crumb {
  code: string;
  name: string;
}

export function CategoryLookupPickerModal({
  open,
  platform,
  lookupUseCase,
  onSelect,
  onClose,
}: CategoryLookupPickerModalProps) {
  const [tab, setTab] = useState<'tree' | 'predict'>('tree');

  // Tree state
  const [path, setPath] = useState<Crumb[]>([]);
  const [nodes, setNodes] = useState<CategoryNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState('');
  const [pendingLeaf, setPendingLeaf] = useState<CategoryNode | null>(null);

  // Predict state
  const [productName, setProductName] = useState('');
  const [suggestions, setSuggestions] = useState<
    { platformCategoryId: string; name: string; namePath: string }[]
  >([]);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState('');
  const [predicted, setPredicted] = useState(false);

  const loadChildren = useCallback(
    async (crumbs: Crumb[]) => {
      setTreeLoading(true);
      setTreeError('');
      setPendingLeaf(null);
      try {
        const parentCode = crumbs.length > 0 ? crumbs[crumbs.length - 1].code : undefined;
        const data = await lookupUseCase.browse(platform, parentCode);
        setNodes(data);
        setPath(crumbs);
      } catch (e) {
        setTreeError(extractErrorMessage(e, '카테고리 조회에 실패했습니다. 활성 계정을 확인하세요.'));
        setNodes([]);
      } finally {
        setTreeLoading(false);
      }
    },
    [lookupUseCase, platform]
  );

  // The modal mounts fresh on each open (parent guards with `&&`), so initial
  // state is already the reset state — the effect only loads root children.
  useEffect(() => {
    void (async () => {
      await loadChildren([]);
    })();
  }, [loadChildren]);

  if (!open) return null;

  const handleNodeClick = (node: CategoryNode) => {
    if (node.leaf) {
      setPendingLeaf(node);
    } else {
      void loadChildren([...path, { code: node.platformCategoryId, name: node.name }]);
    }
  };

  const namePathOf = (leafName: string) => [...path.map((c) => c.name), leafName].join(' > ');

  const confirmLeaf = () => {
    if (!pendingLeaf) return;
    onSelect({
      platformCategoryId: pendingLeaf.platformCategoryId,
      name: pendingLeaf.name,
      namePath: namePathOf(pendingLeaf.name),
    });
  };

  const handlePredict = async () => {
    if (!productName.trim()) return;
    setPredictLoading(true);
    setPredictError('');
    setPredicted(true);
    try {
      const data = await lookupUseCase.predict(platform, productName.trim());
      setSuggestions(data);
    } catch (e) {
      setPredictError(extractErrorMessage(e, '추천 조회에 실패했습니다. 활성 계정을 확인하세요.'));
      setSuggestions([]);
    } finally {
      setPredictLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            카테고리 조회 <span className="text-sm font-normal text-gray-500">({platform})</span>
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('tree')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              tab === 'tree' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            트리 탐색
          </button>
          <button
            onClick={() => setTab('predict')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              tab === 'predict' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            상품명 추천
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'tree' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
                <button
                  onClick={() => void loadChildren([])}
                  className="hover:text-blue-600 hover:underline"
                >
                  루트
                </button>
                {path.map((crumb, idx) => (
                  <span key={crumb.code} className="flex items-center gap-1">
                    <span className="text-gray-400">›</span>
                    <button
                      onClick={() => void loadChildren(path.slice(0, idx + 1))}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>

              {treeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {treeError}
                </div>
              )}

              {treeLoading ? (
                <div className="py-8 flex justify-center">
                  <Spinner size={24} />
                </div>
              ) : nodes.length === 0 && !treeError ? (
                <p className="py-6 text-center text-sm text-gray-500">하위 카테고리가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {nodes.map((node) => (
                    <li key={node.platformCategoryId}>
                      <button
                        onClick={() => handleNodeClick(node)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                          pendingLeaf?.platformCategoryId === node.platformCategoryId
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        <span className="text-gray-900">{node.name}</span>
                        <span className="text-xs text-gray-400">
                          {node.leaf ? '선택 가능' : '펼치기 ›'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {pendingLeaf && (
                <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-gray-700 min-w-0">
                    <p className="truncate">{namePathOf(pendingLeaf.name)}</p>
                    <p className="text-xs text-gray-500">코드: {pendingLeaf.platformCategoryId}</p>
                  </div>
                  <button
                    onClick={confirmLeaf}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                  >
                    이 카테고리 선택
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handlePredict();
                  }}
                  placeholder="상품명 입력 (예: 여성 운동화)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => void handlePredict()}
                  disabled={predictLoading || !productName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
                >
                  {predictLoading ? <Spinner label="조회 중..." /> : '추천'}
                </button>
              </div>

              {predictError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {predictError}
                </div>
              )}

              {predicted && !predictLoading && suggestions.length === 0 && !predictError && (
                <p className="py-6 text-center text-sm text-gray-500">추천 결과가 없습니다.</p>
              )}

              {suggestions.length > 0 && (
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {suggestions.map((sug) => (
                    <li key={sug.platformCategoryId}>
                      <button
                        onClick={() => onSelect(sug)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <p className="text-gray-900">{sug.namePath || sug.name}</p>
                        <p className="text-xs text-gray-400">코드: {sug.platformCategoryId}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
