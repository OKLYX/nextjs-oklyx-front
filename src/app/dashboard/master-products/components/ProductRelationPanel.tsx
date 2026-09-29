'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { GetProductDetailUseCase } from '@/application/usecases/GetProductDetailUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { purchasePlaceNames, type Product } from '@/domain/entities/Product';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { formatKrw } from '@/infrastructure/utils/money';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { toast } from '@/infrastructure/stores/toastStore';
import { ROUTES } from '@/config/routes';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import { PanelProductRegistration } from './PanelProductRegistration';

/** 검색 한 번에 보여줄 최대 건수 — 더 있으면 「더 구체적으로」 안내. */
const SEARCH_SIZE = 20;

type PanelView = { kind: 'list' } | { kind: 'detail'; product: Product } | { kind: 'register' };

interface ProductRelationPanelProps {
  /** `create` = 새로 만들기(판매 상품 관리 마스터) · `view` = 마스터 상세. */
  mode: 'create' | 'view';
  /** 이 마스터의 구성상품 id(순서 = 표시 순서). `null` = 아직 불러오는 중(상세에서 마스터 로드 전). */
  componentIds: number[] | null;
  /** create 전용 — 검색·상세의 [구성상품에 넣기]와 [새 물품 등록] 저장 직후 부른다. */
  onAddComponent?: (product: Product) => void;
  /** create 전용 — [구성상품에 넣기]를 막는 이유(null = 넣을 수 있음). 버튼 아래 글자로 보인다. */
  addBlockedReason?: string | null;
  /** view 전용 — [구성 변경]이 여는 「구성상품 변경」 페이지의 마스터 id. */
  masterId?: number;
}

/**
 * [상품 관계 한눈에 보기]의 **왼쪽 물품 패널** (2609_78 / UX D50·D52·D63·D66·D67).
 * File: src/app/dashboard/master-products/components/ProductRelationPanel.tsx
 *
 * **화면 3가지**(패널 안에서만 바뀐다 — 페이지 이동 없음):
 * | 화면 | 내용 |
 * |---|---|
 * | 목록(기본) | 위 = 구성상품 카드, 아래 = 다른 물품 검색. 카드·검색 결과를 누르면 상세 |
 * | 상세 | [뒤로] · 물품 상세 정보(보기만) · 「물품 화면에서 고치기 ↗」(새 탭) · create 면 [구성상품에 넣기] |
 * | 새 물품 등록 | create 전용. 물품 등록 전체 양식(`PanelProductRegistration`) + [취소] |
 *
 * **모드별 오른쪽 위 버튼**(UX D67): create = [새 물품 등록](저장한 물품은 자동으로 구성상품에 넣는다) ·
 * view = [구성 변경](기존 「구성상품 변경」 페이지로 — 2609_64 D9 유지). view 는 보기만 한다(UX D63).
 *
 * **필수 사용 규칙**:
 * - 판매 상품 관리 마스터(`MasterProductCreateForm`)와 마스터 상세(`CoverageMatrix`) 두 곳에서만 쓴다.
 * - 구성상품을 **실제로 바꾸는 일은 부모가** 한다(create = `onAddComponent`). 패널은 부모 상태를 모른다.
 * - 물품 값(이름·규격·사진)은 여기서 고치지 않는다 — 물품 하나가 여러 마스터에 쓰여 다른 마스터에 번진다.
 *
 * @example
 * // 새로 만들기
 * <ProductRelationPanel mode="create" componentIds={selectedIds} onAddComponent={addComponent} addBlockedReason={null} />
 * // 마스터 상세
 * <ProductRelationPanel mode="view" componentIds={master ? master.components.map((c) => c.productId) : null} masterId={id} />
 *
 * ❌ 팝업(`ui/Modal`)으로 바꾸지 말 것 — 패널은 페이지 안의 작업 표면이다.
 * ❌ `overflow-*` 를 패널에 걸지 말 것 — 페이지 스크롤 하나로 본다(안쪽 드롭다운이 잘린다).
 */
export function ProductRelationPanel({
  mode,
  componentIds,
  onAddComponent,
  addBlockedReason = null,
  masterId,
}: ProductRelationPanelProps) {
  const router = useRouter();
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const detailUseCase = useMemo(() => new GetProductDetailUseCase(new ProductRepositoryImpl()), []);

  const [view, setView] = useState<PanelView>({ kind: 'list' });
  // 구성상품 카드용 물품(id → 물품). 검색 결과·새로 등록한 물품도 넣어 다시 조회하지 않는다.
  const [cache, setCache] = useState<Record<number, Product>>({});
  // 단건 조회에 실패한 구성상품 id — 다시 조회하지 않고 `#id` 카드로 남긴다.
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 캐시에 없는 구성상품만 단건 조회한다(구성상품은 보통 몇 개뿐). 문자열 키 = 목록이 실제로 바뀔 때만 다시 돈다.
  const missingKey = (componentIds ?? [])
    .filter((id) => cache[id] == null && !failedIds.includes(id))
    .join(',');
  useEffect(() => {
    if (missingKey === '') return;
    let alive = true;
    void (async () => {
      const ids = missingKey.split(',').map(Number);
      const fetched = await Promise.all(
        ids.map((id) => detailUseCase.getProduct(id).catch(() => null)),
      );
      if (!alive) return;
      setCache((prev) => {
        const next = { ...prev };
        for (const p of fetched) if (p != null) next[p.id] = p;
        return next;
      });
      setFailedIds((prev) => [...prev, ...ids.filter((_, i) => fetched[i] == null)]);
    })();
    return () => {
      alive = false;
    };
  }, [missingKey, detailUseCase]);

  const openDetail = (product: Product) => {
    setCache((prev) => ({ ...prev, [product.id]: product }));
    setView({ kind: 'detail', product });
  };

  const runSearch = async () => {
    const query = searchInput.trim();
    if (!query) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await productsUseCase.getProducts({ page: 0, size: SEARCH_SIZE, search: query });
      setResults(res.content);
      setTotalMatches(res.totalElements);
    } catch (e) {
      setResults([]);
      setTotalMatches(0);
      setSearchError(extractErrorMessage(e, '물품을 검색하지 못했습니다.'));
    } finally {
      setHasSearched(true);
      setSearching(false);
    }
  };

  // [새 물품 등록] 저장 성공 — 알림 → 목록으로 → 구성상품에 넣기(UX D67: 새로 만들 때는 자동으로 넣는다).
  // 넣을 수 없는 상태(옵션 편집 중)면 그 물품 상세로 보낸다 — [구성상품에 넣기] 비활성 + 이유 글자(UX D36).
  const handleRegistered = useCallback(
    (product: Product) => {
      setCache((prev) => ({ ...prev, [product.id]: product }));
      toast.success('물품을 등록했습니다.');
      if (addBlockedReason != null) {
        setView({ kind: 'detail', product });
        return;
      }
      setView({ kind: 'list' });
      onAddComponent?.(product);
    },
    [onAddComponent, addBlockedReason],
  );

  const handleRegisterCancel = useCallback(() => setView({ kind: 'list' }), []);

  return (
    <Card padded={false}>
      <div className="space-y-3 p-4">
        {view.kind === 'list' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                구성상품{componentIds ? ` ${componentIds.length}개` : ''}
              </h2>
              {mode === 'create' ? (
                <Button size="sm" variant="secondary" onClick={() => setView({ kind: 'register' })}>
                  새 물품 등록
                </Button>
              ) : masterId != null ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(ROUTES.MASTER_PRODUCT_COMPOSITION(masterId))}
                >
                  구성 변경
                </Button>
              ) : null}
            </div>

            {componentIds == null ? (
              <Spinner label="불러오는 중..." />
            ) : componentIds.length === 0 ? (
              <p className="text-sm text-gray-500">구성상품이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {componentIds.map((id) => {
                  const product = cache[id];
                  return (
                    <li key={id}>
                      {product ? (
                        <ProductCard product={product} onClick={() => openDetail(product)} />
                      ) : (
                        <div className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-500">
                          {failedIds.includes(id) ? `#${id} (불러오지 못했습니다)` : '불러오는 중…'}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-gray-200 pt-3">
              <p className="mb-1 text-xs font-medium text-gray-600">다른 물품 찾아보기</p>
              <div className="flex gap-2">
                <Input
                  size="sm"
                  className="min-w-0 flex-1"
                  placeholder="상품명으로 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runSearch();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => void runSearch()}
                  disabled={searching || searchInput.trim() === ''}
                >
                  {searching ? <Spinner label="검색 중..." /> : '검색'}
                </Button>
              </div>
              {searchError && (
                <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>
              )}
              {hasSearched && !searchError && results.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">검색 결과가 없습니다.</p>
              )}
              {results.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {results.map((p) => (
                    <li key={p.id}>
                      <ProductCard product={p} onClick={() => openDetail(p)} />
                    </li>
                  ))}
                </ul>
              )}
              {totalMatches > results.length && results.length > 0 && (
                <p className="mt-1 text-[11px] text-gray-400">
                  {totalMatches}개 중 {results.length}개 표시 — 더 구체적으로 검색하세요.
                </p>
              )}
            </div>
          </>
        )}

        {view.kind === 'detail' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={() => setView({ kind: 'list' })}>
                뒤로
              </Button>
              <a
                href={ROUTES.PRODUCT_DETAIL(view.product.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                물품 화면에서 고치기 ↗
              </a>
            </div>
            <ProductBrief product={view.product} />
            {mode === 'create' &&
              ((componentIds ?? []).includes(view.product.id) ? (
                <p className="text-xs text-gray-500">이미 구성상품입니다.</p>
              ) : (
                <div className="space-y-1">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onAddComponent?.(view.product)}
                    disabled={addBlockedReason != null}
                  >
                    구성상품에 넣기
                  </Button>
                  {addBlockedReason && (
                    <p className="text-[11px] text-amber-700">{addBlockedReason}</p>
                  )}
                </div>
              ))}
          </>
        )}

        {view.kind === 'register' && mode === 'create' && (
          <PanelProductRegistration onCreated={handleRegistered} onCancel={handleRegisterCancel} />
        )}
      </div>
    </Card>
  );
}

/** 구성상품·검색 결과 한 장 — 누르면 패널 안 상세로. */
function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const src = getProductThumbUrl(product.imageUrl, product.id);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded border border-gray-200 px-2 py-1.5 text-left hover:bg-blue-50"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={product.productName}
          className="h-10 w-10 shrink-0 rounded border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-100 text-[10px] text-gray-400">
          없음
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-900">{product.productName}</span>
        <span className="block truncate text-[11px] text-gray-500">
          {product.brand || '-'} · {formatKrw(product.price)}
        </span>
      </span>
    </button>
  );
}

/** 물품 상세 정보(보기만). 항목·라벨은 물품 상세 화면(`ProductDetailView`)의 「상품 정보」와 같다. */
function ProductBrief({ product }: { product: Product }) {
  const src = getProductThumbUrl(product.imageUrl, product.id);
  const rows: { label: string; value: string | null | undefined }[] = [
    { label: '바코드 ID', value: product.barcodeId },
    { label: '브랜드', value: product.brand },
    { label: '가격', value: product.price == null ? null : formatKrw(product.price) },
    { label: '구매처', value: purchasePlaceNames(product) },
    { label: '내용물 양', value: product.netContent },
    { label: '단위', value: product.netContentUnit },
    { label: '개수', value: product.countQuantity != null ? String(product.countQuantity) : null },
    { label: '개수 단위', value: product.countUnit },
    { label: '높이', value: product.packageHeight },
    { label: '길이', value: product.packageLength },
    { label: '너비', value: product.packageWidth },
  ];
  return (
    <div className="space-y-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={product.productName}
          className="h-24 w-24 rounded border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400">
          이미지 없음
        </div>
      )}
      <p className="text-sm font-semibold text-gray-900">{product.productName}</p>
      <dl className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="shrink-0 text-gray-500">{row.label}</dt>
            <dd className="min-w-0 break-words text-right text-gray-900">
              {row.value != null && row.value.trim() !== '' ? row.value : '-'}
            </dd>
          </div>
        ))}
      </dl>
      {product.description && (
        <div className="border-t border-gray-200 pt-2">
          <p className="mb-1 text-xs font-medium text-gray-500">설명</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{product.description}</p>
        </div>
      )}
    </div>
  );
}
