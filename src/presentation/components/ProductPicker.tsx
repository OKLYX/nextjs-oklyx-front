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
 * Shared picker that chooses one product (Product) by searching its name.
 *
 * Search = Enter or [검색], top 10 results. Each result row shows the main photo (a 「없음」 box when there is none).
 * The caller owns the selection (controlled component) — a non-null `productId` draws the selected state.
 *
 * Two looks:
 * - default — before a pick: search input + results; after a pick: only name #ID + [변경] (fits one form row).
 * - `fixedResults` — the results area is reserved at a fixed height; after a pick the search bar and results stay and
 *   only the picked row is highlighted. Use it inside a popup so the popup size does not follow the result count.
 *
 * Used by:
 * - stock in/out form `stock/in-out/StockInOutForm` (default, FEATURE_2609_28)
 * - purchase list manual add `purchase/list/AddManualItemModal` (`fixedResults`)
 * - purchase list receipt check-in `purchase/list/ReceiptIntakeModal` (default, one picker per line, FEATURE_2610_18)
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
 * // inside a popup — fixed results area
 * <ProductPicker fixedResults productId={…} productName={…} onSelect={…} onClear={…} />
 *
 * ⚠️ It picks a product (Product), not a sales option or a master product.
 * ⚠️ The photo src is `getProductThumbUrl` (main photo) — the same rule as the product list.
 * ❌ Do not add a field that takes a product ID as a typed number — use this component.
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
    <div className="flex gap-2 max-md:flex-wrap">
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
