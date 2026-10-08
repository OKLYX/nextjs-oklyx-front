'use client';

import { useMemo, useState } from 'react';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';

const SEARCH_SIZE = 10;

interface ProductPickerProps {
  productId: number | null;
  productName: string;
  onSelect: (productId: number, productName: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * 물품(Product) 한 개를 상품명 검색으로 고르는 공통 선택기.
 *
 * 선택 전에는 검색 입력(Enter 또는 [검색], 상위 10건), 선택 후에는 이름 #ID + [변경] 만 보인다.
 * 선택 상태는 호출부가 가진다(제어 컴포넌트) — `productId` 가 null 이 아니면 선택 상태로 그린다.
 *
 * 사용처:
 * - 입출고 폼 `stock/in-out/StockInOutForm` (FEATURE_2609_28)
 * - 구매목록 수동 항목 추가 `purchase/list/AddManualItemModal`
 *
 * @example
 * <ProductPicker
 *   productId={selected?.id ?? null}
 *   productName={selected?.name ?? ''}
 *   onSelect={(id, name) => setSelected({ id, name })}
 *   onClear={() => setSelected(null)}
 * />
 *
 * ⚠️ 판매 옵션·마스터 상품이 아니라 물품(Product) 을 고른다.
 * ❌ 물품 ID 를 숫자로 직접 입력받는 칸을 새로 만들지 말고 이 컴포넌트를 쓴다.
 */
export function ProductPicker({
  productId,
  productName,
  onSelect,
  onClear,
  disabled = false,
}: ProductPickerProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<{ id: number; productName: string }[]>([]);
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
      setResults(response.content.map((p) => ({ id: p.id, productName: p.productName })));
    } catch {
      setError('상품 조회에 실패했습니다.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (id: number, name: string) => {
    onSelect(id, name);
    setResults([]);
    setHasSearched(false);
    setKeyword('');
  };

  if (productId !== null) {
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

  return (
    <div className="space-y-2">
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
          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <p className="text-xs text-gray-500">검색 결과가 없습니다.</p>
      )}

      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => handleSelect(product.id, product.productName)}
                className="w-full text-left px-2 py-1 text-sm hover:bg-blue-50"
              >
                {product.productName} <span className="text-gray-400">#{product.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
