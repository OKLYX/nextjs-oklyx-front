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
 * 입고·조정 폼의 물품 선택 (FEATURE_2609_28).
 *
 * 원장은 <b>물품(Product)</b> 단위다 — 판매 옵션이 아니라 창고에 실물로 있는 것이다.
 * 선택 전에는 검색 입력, 선택 후에는 이름 + [변경] 만 보인다.
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
