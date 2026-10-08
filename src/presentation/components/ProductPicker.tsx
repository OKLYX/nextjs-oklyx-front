'use client';

import { useMemo, useState } from 'react';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';

const SEARCH_SIZE = 10;

interface PickerResult {
  id: number;
  productName: string;
  imageUrl?: string;
}

interface ProductPickerProps {
  productId: number | null;
  productName: string;
  onSelect: (productId: number, productName: string) => void;
  onClear: () => void;
  disabled?: boolean;
  /**
   * Reserve the results area up front (fixed height) so the surrounding popup
   * never grows or shrinks with the result count. The search bar stays visible
   * after a pick and the chosen row is highlighted instead of collapsing.
   */
  fixedResults?: boolean;
}

/**
 * 물품(Product) 한 개를 상품명 검색으로 고르는 공통 선택기.
 *
 * 검색 = Enter 또는 [검색], 상위 10건. 결과 행마다 대표 사진(없으면 「없음」 상자).
 * 선택 상태는 호출부가 가진다(제어 컴포넌트) — `productId` 가 null 이 아니면 선택 상태로 그린다.
 *
 * 두 가지 모양:
 * - 기본 — 선택 전에는 검색 입력 + 결과, 선택 후에는 이름 #ID + [변경] 만 보인다(폼 한 줄 안에 쓰기 좋다).
 * - `fixedResults` — 결과 칸을 고정 높이로 미리 잡아 두고, 선택해도 검색창·결과를 그대로 둔 채
 *   고른 행만 강조한다. 팝업 안에서 결과 개수에 따라 팝업 크기가 바뀌지 않게 할 때 쓴다.
 *
 * 사용처:
 * - 입출고 폼 `stock/in-out/StockInOutForm` (기본, FEATURE_2609_28)
 * - 구매목록 수동 항목 추가 `purchase/list/AddManualItemModal` (`fixedResults`)
 *
 * @example
 * <ProductPicker
 *   productId={selected?.id ?? null}
 *   productName={selected?.name ?? ''}
 *   onSelect={(id, name) => setSelected({ id, name })}
 *   onClear={() => setSelected(null)}
 * />
 *
 * @example
 * // 팝업 안 — 결과 칸 고정
 * <ProductPicker fixedResults productId={…} productName={…} onSelect={…} onClear={…} />
 *
 * ⚠️ 판매 옵션·마스터 상품이 아니라 물품(Product) 을 고른다.
 * ⚠️ 사진 src 는 `getProductThumbUrl`(대표 사진) — 상품 목록과 같은 규칙.
 * ❌ 물품 ID 를 숫자로 직접 입력받는 칸을 새로 만들지 말고 이 컴포넌트를 쓴다.
 */
export function ProductPicker({
  productId,
  productName,
  onSelect,
  onClear,
  disabled = false,
  fixedResults = false,
}: ProductPickerProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<PickerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const getProductsUseCase = useMemo(
    () => new GetProductsUseCase(new ProductRepositoryImpl()),
    []
  );

  const search = async () => {
    setIsSearching(true);
    setError('');
    setHasSearched(true);
    try {
      const response = await getProductsUseCase.getProducts({
        page: 0,
        size: SEARCH_SIZE,
        search: keyword.trim() || undefined,
      });
      setResults(
        response.content.map((p) => ({ id: p.id, productName: p.productName, imageUrl: p.imageUrl }))
      );
    } catch {
      setError('상품 조회에 실패했습니다.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (id: number, name: string) => {
    onSelect(id, name);
    // The fixed layout keeps the list so the pick stays visible and changeable.
    if (fixedResults) return;
    setResults([]);
    setHasSearched(false);
    setKeyword('');
  };

  const thumbnail = (product: PickerResult) => {
    const src = getProductThumbUrl(product.imageUrl, product.id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={product.productName}
        className="w-10 h-10 shrink-0 rounded border border-gray-200 object-cover bg-gray-50"
      />
    ) : (
      <div className="w-10 h-10 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
        없음
      </div>
    );
  };

  if (productId !== null && !fixedResults) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-sm text-gray-800">
          {productName} <span className="text-gray-400">#{productId}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          변경
        </button>
      </div>
    );
  }

  const searchRow = (
    <div className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search();
          }
        }}
        placeholder="상품명 검색"
        disabled={disabled}
        className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 ${
          fixedResults ? 'flex-1 min-w-0' : ''
        }`}
      />
      <button
        type="button"
        onClick={search}
        disabled={disabled || isSearching}
        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
      >
        {isSearching ? '검색 중...' : '검색'}
      </button>
    </div>
  );

  const resultRows = results.map((product) => {
    const selected = product.id === productId;
    return (
      <li key={product.id}>
        <button
          type="button"
          onClick={() => handleSelect(product.id, product.productName)}
          disabled={disabled}
          aria-pressed={fixedResults ? selected : undefined}
          className={`w-full flex items-center gap-2 text-left px-2 py-1 text-sm disabled:opacity-50 ${
            selected ? 'bg-blue-50' : 'hover:bg-blue-50'
          }`}
        >
          {thumbnail(product)}
          <span className="min-w-0 flex-1 truncate">
            {product.productName} <span className="text-gray-400">#{product.id}</span>
          </span>
          {selected && <span className="shrink-0 text-xs font-medium text-blue-700">선택됨</span>}
        </button>
      </li>
    );
  });

  if (fixedResults) {
    // Status text renders inside the reserved box, so the box height never changes.
    let status: string | null = null;
    if (error) status = error;
    else if (isSearching) status = '검색 중...';
    else if (!hasSearched) status = '상품명으로 검색하세요.';
    else if (results.length === 0) status = '검색 결과가 없습니다.';

    return (
      <div className="space-y-2">
        {searchRow}
        <div className="h-64 overflow-y-auto border border-gray-200 rounded">
          {status ? (
            <p
              className={`h-full flex items-center justify-center text-xs ${
                error ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              {status}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">{resultRows}</ul>
          )}
        </div>
        <p className="h-5 text-sm text-gray-700 truncate">
          {productId !== null ? (
            <>
              선택: {productName} <span className="text-gray-400">#{productId}</span>
            </>
          ) : (
            <span className="text-gray-400">선택한 상품 없음</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {searchRow}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <p className="text-xs text-gray-500">검색 결과가 없습니다.</p>
      )}

      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
          {resultRows}
        </ul>
      )}
    </div>
  );
}
