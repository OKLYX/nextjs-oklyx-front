'use client';

import { useState, useCallback } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { CategoryTreeColumns, type TreeNode } from '@/presentation/components/CategoryTreeColumns';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { CategorySuggestion } from '@/domain/entities/CategoryLookupEntity';
import { Modal } from '@/presentation/components/ui/Modal';
import { platformDisplayName } from '@/config/platforms';

/**
 * Marketplace category lookup picker (name search + column tree + product-name prediction) — pick without typing codes.
 *
 * Built on `ui/Modal` (no shadcn). The useCase is **the parent's instance**
 * (never created inside the modal). Confirming calls `onSelect({platformCategoryId, name, namePath})`.
 * The tree is the shared `CategoryTreeColumns` (same left→right columns as the standard category tree), keyed by
 * the marketplace code the lookup returns. The search box reads the imported list on the server (no account).
 * A lookup failure (no active account / 500) shows inside the tree column or under the search box.
 * 11st (ELEVENST) and ESM have no product-name prediction (FEATURE_2610_10 / D21 ③ · FEATURE_2610_26 / D12) — their
 * predict tab is not rendered.
 */
interface CategoryLookupPickerModalProps {
  open: boolean;
  platform: 'COUPANG' | 'NAVER' | 'ELEVENST' | 'ESM';
  lookupUseCase: CategoryLookupUseCase;
  onSelect: (sel: { platformCategoryId: string; name: string; namePath: string }) => void;
  onClose: () => void;
  /**
   * What is already chosen elsewhere (standard category · other platforms), shown above the search box so a
   * similar category can be picked. Absent / empty = nothing shown.
   */
  references?: { label: string; path: string }[];
}

/** The server returns at most this many search results. */
const SEARCH_LIMIT = 50;

export function CategoryLookupPickerModal({
  open,
  platform,
  lookupUseCase,
  onSelect,
  onClose,
  references,
}: CategoryLookupPickerModalProps) {
  const [tab, setTab] = useState<'tree' | 'predict'>('tree');

  // Picked leaf (from the search results or the tree), confirmed with [이 카테고리 선택].
  const [pendingLeaf, setPendingLeaf] = useState<CategorySuggestion | null>(null);

  // Search state
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<CategorySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  // Predict state
  const [productName, setProductName] = useState('');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState('');
  const [predicted, setPredicted] = useState(false);

  // Stable reference — the tree reloads its root whenever `browse` changes.
  const browse = useCallback(
    async (parentCode?: string): Promise<TreeNode<string>[]> => {
      const nodes = await lookupUseCase.browse(platform, parentCode);
      return nodes.map((n) => ({ id: n.platformCategoryId, name: n.name, leaf: n.leaf }));
    },
    [lookupUseCase, platform]
  );

  if (!open) return null;

  const handleTreeLeaf = (leaf: TreeNode<string>, path: TreeNode<string>[]) => {
    setPendingLeaf({
      platformCategoryId: leaf.id,
      name: leaf.name,
      namePath: path.map((n) => n.name).join(' > '),
    });
  };

  const handleSearch = async () => {
    const q = keyword.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearched(true);
    try {
      setResults(await lookupUseCase.search(platform, q));
    } catch (e) {
      setSearchError(extractErrorMessage(e, '카테고리 검색에 실패했습니다.'));
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const confirmLeaf = () => {
    if (!pendingLeaf) return;
    onSelect(pendingLeaf);
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
    <Modal isOpen onClose={onClose} title={`카테고리 조회 (${platformDisplayName(platform)})`}>

        <div className="flex border-b max-md:flex-wrap">
          <button
            onClick={() => setTab('tree')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              tab === 'tree' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            카테고리 찾기
          </button>
          {platform !== 'ELEVENST' && platform !== 'ESM' && (
            <button
              onClick={() => setTab('predict')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                tab === 'predict' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
              }`}
            >
              상품명 추천
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {references && references.length > 0 && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-gray-500">참고 — 지금 고른 카테고리</p>
              {references.map((r) => (
                <p key={r.label} className="truncate text-gray-700" title={r.path}>
                  <span className="font-medium">{r.label}</span> : {r.path}
                </p>
              ))}
            </div>
          )}
          {tab === 'tree' ? (
            <div className="space-y-3">
              <div className="flex gap-2 max-md:flex-wrap">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSearch();
                  }}
                  placeholder="카테고리 이름 검색 (예: 사이드테이블)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching || !keyword.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
                >
                  {searching ? <Spinner label="검색 중..." /> : '검색'}
                </button>
              </div>

              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {searchError}
                </div>
              )}

              {searched && !searching && !searchError && results.length === 0 && (
                <p className="py-2 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
              )}

              {results.length > 0 && (
                <div className="space-y-1">
                  <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto border border-gray-200 rounded-lg">
                    {results.map((r) => (
                      <li key={r.platformCategoryId}>
                        <button
                          onClick={() => setPendingLeaf(r)}
                          title={r.namePath}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                            pendingLeaf?.platformCategoryId === r.platformCategoryId ? 'bg-blue-50' : ''
                          }`}
                        >
                          <p className="text-gray-900">{r.name}</p>
                          <p className="truncate text-xs text-gray-400">{r.namePath}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {results.length >= SEARCH_LIMIT && (
                    <p className="text-xs text-gray-500">
                      결과가 많아 {SEARCH_LIMIT}개만 보입니다. 더 구체적으로 검색하세요.
                    </p>
                  )}
                </div>
              )}

              <CategoryTreeColumns
                browse={browse}
                onSelectLeaf={handleTreeLeaf}
                selectedId={pendingLeaf?.platformCategoryId ?? null}
              />

              {pendingLeaf && (
                <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-gray-700 min-w-0">
                    <p className="truncate">{pendingLeaf.namePath || pendingLeaf.name}</p>
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
              <div className="flex gap-2 max-md:flex-wrap">
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
    </Modal>
  );
}
