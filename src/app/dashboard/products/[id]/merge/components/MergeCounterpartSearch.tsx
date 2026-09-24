'use client';

import { useCallback, useState } from 'react';
import type { Product } from '@/domain/entities/Product';
import type { FindProductByBarcodeUseCase } from '@/application/usecases/FindProductByBarcodeUseCase';
import type { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { Input } from '@/presentation/components/ui/Input';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';

/**
 * 병합할 **상대 물품** 고르기 (FEATURE_2609_69 / B).
 *
 * 중복의 근거가 바코드라 바코드가 첫 번째 길이다. 숫자 8자리 이상이면 바코드로 보고
 * 정확히 일치하는 물품을 찾고, 그 밖의 입력은 상품명·브랜드·설명 검색으로 돌린다
 * (⚠️ 서버 검색은 바코드를 보지 않는다 — `FindProductByBarcodeUseCase` 주석 참고).
 *
 * 🔴 결과 줄에는 **대표 사진**을 같이 보여준다 — 이름·바코드만으로는 같은 물건인지 가리기 어렵고,
 *    사진이 중복 판단의 가장 빠른 근거다(2026-09-24). 사진 주소는 목록 화면과 같은
 *    `getProductThumbUrl` 로 푼다(S3 는 직접, 로컬은 인증 프록시).
 */
const KEYWORD_PAGE_SIZE = 20;

function looksLikeBarcode(value: string): boolean {
  return /^\d{8,}$/.test(value.trim());
}

export interface MergeCounterpartSearchProps {
  currentProductId: number;
  findByBarcode: FindProductByBarcodeUseCase;
  getProducts: GetProductsUseCase;
  /** 상세에서 들고 온 바코드 — 입력칸 초기값으로 넣어 바로 [찾기]를 누를 수 있게 한다 */
  initialBarcode?: string;
  onSelect: (product: Product) => void;
  disabled?: boolean;
}

export function MergeCounterpartSearch({
  currentProductId,
  findByBarcode,
  getProducts,
  initialBarcode,
  onSelect,
  disabled = false,
}: MergeCounterpartSearchProps) {
  const [keyword, setKeyword] = useState(initialBarcode ?? '');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');

  const search = useCallback(async () => {
    const value = keyword.trim();
    if (!value) return;
    setIsSearching(true);
    setNotice('');
    setResults([]);
    try {
      if (looksLikeBarcode(value)) {
        const found = await findByBarcode.execute(value, currentProductId);
        if (found) {
          setResults([found]);
        } else {
          setNotice('해당 바코드를 가진 다른 물품이 없습니다.');
        }
        return;
      }
      const page = await getProducts.getProducts({ page: 0, size: KEYWORD_PAGE_SIZE, search: value });
      const others = page.content.filter((product) => product.id !== currentProductId);
      setResults(others);
      if (others.length === 0) setNotice('검색 결과가 없습니다.');
    } catch (err) {
      setNotice(extractErrorMessage(err, '물품을 찾지 못했습니다.'));
    } finally {
      setIsSearching(false);
    }
  }, [keyword, findByBarcode, getProducts, currentProductId]);

  return (
    <Card title="병합할 상대 물품">
      <p className="mb-3 text-sm text-gray-600">
        같은 물건이 두 번 등록된 경우 그 물품을 찾습니다. 바코드를 넣으면 정확히 같은 바코드를 가진
        물품을, 그 밖의 말은 상품명·브랜드·설명에서 찾습니다.
      </p>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input
          className="flex-1"
          placeholder="바코드 또는 상품명"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          disabled={disabled || isSearching}
        />
        <Button type="submit" isLoading={isSearching} loadingText="찾는 중…" disabled={disabled}>
          찾기
        </Button>
      </form>

      {notice && <p className="mt-3 text-sm text-gray-600">{notice}</p>}

      {results.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {results.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <ResultThumbnail product={product} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    #{product.id} {product.productName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.brand || '브랜드 없음'} · 바코드 {product.barcodeId || '없음'}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onSelect(product)} disabled={disabled}>
                이 물품과 병합
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** 결과 줄의 대표 사진. 사진이 없는 물품도 줄 높이가 흔들리지 않게 같은 크기의 빈 칸을 둔다. */
function ResultThumbnail({ product }: { product: Product }) {
  const src = getProductThumbUrl(product.imageUrl, product.id);
  if (!src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-300">
        없음
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={product.productName}
      className="h-12 w-12 shrink-0 rounded border border-gray-200 bg-gray-50 object-cover"
    />
  );
}
