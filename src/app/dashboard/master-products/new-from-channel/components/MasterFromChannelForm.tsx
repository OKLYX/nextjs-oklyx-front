'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { Product } from '@/domain/entities/Product';
import type {
  MasterFromChannelOption,
  MasterFromChannelPreview,
} from '@/domain/entities/ListingRegistrationEntity';

// 상태 enum → 화면 문구(enum 원문을 사용자에게 노출하지 않는다). 가져오기 모달과 같은 한 줄짜리 표지만,
// 서로 import 하면 화면 간 결합이 생기므로 지역으로 둔다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

// 오늘 지원하는 마켓은 쿠팡 하나다(D17: 플랫폼이 늘면 여기 한 줄만 는다).
const PLATFORMS: { value: string; label: string }[] = [{ value: 'COUPANG', label: '쿠팡' }];

// D5(얕은 생성)의 사용자 대면 설명. 이미지·상세가 비어 있는 이유와 다음 행동을 알려주지 않으면
// 사용자가 [마켓 반영]을 눌러 실물 상품을 덮을 수 있다.
const SUCCESS_NOTICE =
  '마스터와 채널이 만들어졌습니다. 이미지·상세는 이 화면에서 채운 뒤 [재생성]하세요.';

const PRODUCT_SEARCH_LIMIT = 50;

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

/** 옵션 식별 키. 미승인 옵션은 마켓 옵션 id 가 없어 itemName 으로 대신한다(서버 매칭 규칙과 동일). */
const optionKey = (o: MasterFromChannelOption) => o.platformOptionId ?? o.itemName;

const isPositiveInt = (raw: string) => {
  const v = Number(raw);
  return raw.trim() !== '' && Number.isInteger(v) && v >= 1;
};

/**
 * 마켓 상품으로 마스터 만들기 (FEATURE_2609_45 / D1·D17).
 * File: src/app/dashboard/master-products/new-from-channel/components/MasterFromChannelForm.tsx
 *
 * 쿠팡 상품 ID 하나로 옵션이 자동으로 채워지고, 사용자는 **구성상품 · 옵션별 수량 · 마스터 이름**만
 * 정한다(D3). 옵션명·판매가·정가·재고·옵션 id·상태·태그는 마켓 값을 그대로 쓴다.
 *
 * - 기존 생성 폼(`/dashboard/master-products/new`)과 **완전히 분리된 화면**이다(D1).
 *   저쪽 마법사에 모드 분기를 넣지 않는다 — 검증된 경로가 같이 흔들린다.
 * - 단계 구분은 `preview` 유무 하나로만 한다(별도 step state 금지 — 조회 실패 후 돌아갈 자리가
 *   하나여야 한다).
 * - ⚠️ 판매가·재고 입력칸을 만들지 않는다. 서버가 커밋 시점에 마켓을 재조회해 확정한다.
 * - ⚠️ 미리보기 응답을 캐시하지 않는다(가격·재고는 변한다). 페이지를 떠나면 버린다.
 * - ⚠️ 수량은 **문자열 state** 로 들고 제출 직전에 한 번만 숫자로 바꾼다(입력 중 변환하면 지우는
 *   순간 값이 튄다).
 */
export function MasterFromChannelForm() {
  const router = useRouter();

  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);

  // ① 판매자 · 마켓
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [platform, setPlatform] = useState(PLATFORMS[0].value);

  // ② 마켓 상품 ID
  const [productId, setProductId] = useState('');

  // ③~⑧ 조회 결과와 입력
  const [preview, setPreview] = useState<MasterFromChannelPreview | null>(null);
  const [masterName, setMasterName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [categoryName, setCategoryName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // optionKey → (productId → 입력 문자열)
  const [quantities, setQuantities] = useState<Record<string, Record<number, string>>>({});
  const [metaOpen, setMetaOpen] = useState(false);

  // 구성상품 후보
  const [products, setProducts] = useState<Product[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productHasSearched, setProductHasSearched] = useState(false);

  // per-action 스피너(전역 오버레이 금지)
  const [looking, setLooking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // CategoryTreeColumns 의 mount 이펙트가 매 렌더 재실행되지 않도록 안정된 참조로 넘긴다.
  const browseTree = useCallback(
    (parentId?: number) => categoryUseCase.browseTree(parentId),
    [categoryUseCase],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sellerList, prod] = await Promise.all([
          sellerUseCase.getAll(),
          productsUseCase.getProducts({ page: 0, size: 1000 }),
        ]);
        if (!alive) return;
        setSellers(sellerList);
        setProducts(prod.content);
      } catch {
        if (alive) setError('판매자·구성상품 후보를 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase, productsUseCase]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.productName ?? '').toLowerCase().includes(q));
  }, [products, productQuery]);

  const searchMatches = useMemo(() => {
    const selected = new Set(selectedIds);
    return filteredProducts.filter((p) => !selected.has(p.id));
  }, [filteredProducts, selectedIds]);
  const searchResults = searchMatches.slice(0, PRODUCT_SEARCH_LIMIT);

  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p != null),
    [selectedIds, products],
  );

  /** 상품 ID 를 고쳐 다시 조회하면 이전 결과와 이름·수량 입력을 함께 버린다(옵션 집합이 달라지면
   *  수량이 뜻을 잃는다). 구성상품 선택은 마켓 응답과 무관하므로 유지한다. */
  const handleLookup = async () => {
    if (sellerId === '' || productId.trim() === '' || looking) return;
    setLooking(true);
    setError('');
    setPreview(null);
    setMasterName('');
    setCategoryId('');
    setCategoryName('');
    setQuantities({});
    try {
      const res = await listingUseCase.masterFromChannelPreview({
        sellerId,
        platform,
        platformProductId: productId.trim(),
      });
      setPreview(res);
      setMasterName(res.suggestedMasterName ?? res.productName ?? '');
      if (res.categoryResolved && res.suggestedCategoryId != null) {
        setCategoryId(res.suggestedCategoryId);
        setCategoryName(res.suggestedCategoryName ?? '');
      }
      // 이미 고른 구성상품이 있으면 그 열의 수량을 1 로 채워 둔다.
      setQuantities(
        Object.fromEntries(
          res.options.map((o) => [
            optionKey(o),
            Object.fromEntries(selectedIds.map((id) => [id, '1'])),
          ]),
        ),
      );
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '상품을 조회하지 못했습니다.'));
    } finally {
      setLooking(false);
    }
  };

  /** 구성상품을 바꾸면 ⑦의 열이 바뀐다 → 그 물품의 수량 칸만 초기화(다른 칸은 유지). */
  const toggleProduct = (id: number) => {
    const adding = !selectedIds.includes(id);
    setSelectedIds((prev) => (adding ? [...prev, id] : prev.filter((x) => x !== id)));
    setQuantities((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, row]) => {
          const next = { ...row };
          if (adding) next[id] = '1';
          else delete next[id];
          return [key, next];
        }),
      ),
    );
  };

  const setQuantity = (key: string, pid: number, raw: string) =>
    setQuantities((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [pid]: raw } }));

  const handleProductSearch = () => {
    if (!productFilter.trim()) return;
    setProductQuery(productFilter);
    setProductHasSearched(true);
  };

  const quantityInvalid =
    preview != null &&
    (selectedIds.length === 0 ||
      preview.options.some((o) =>
        selectedIds.some((pid) => !isPositiveInt(quantities[optionKey(o)]?.[pid] ?? '')),
      ));

  // 제출 차단 사유(있으면 [마스터 만들기] 비활성 + 인라인 표시). 왜 못 누르는지 숨기지 않는다.
  const blockReason =
    preview == null
      ? null
      : masterName.trim() === ''
        ? '마스터 이름을 입력하세요.'
        : categoryId === ''
          ? '표준 카테고리를 선택하세요.'
          : selectedIds.length === 0
            ? '구성상품을 1개 이상 선택하세요.'
            : quantityInvalid
              ? '모든 옵션의 구성상품 수량을 입력하세요'
              : null;

  const handleCreate = async () => {
    if (preview == null || sellerId === '' || categoryId === '' || blockReason != null || creating) {
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await listingUseCase.createMasterFromChannel({
        sellerId,
        platform,
        platformProductId: productId.trim(),
        masterName: masterName.trim(),
        categoryId,
        componentProductIds: selectedIds,
        options: preview.options.map((o) => {
          const row = quantities[optionKey(o)] ?? {};
          return {
            platformOptionId: o.platformOptionId,
            itemName: o.itemName,
            // 수량 문자열 → 숫자 변환은 여기 한 번뿐이다.
            components: selectedIds.map((pid) => ({
              productId: pid,
              quantity: Number(row[pid]),
            })),
          };
        }),
      });
      router.push(
        `${ROUTES.MASTER_PRODUCT_DETAIL(res.masterProductId)}?notice=${encodeURIComponent(SUCCESS_NOTICE)}`,
      );
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // 400 은 전부 사람이 읽을 문구로 온다 → 가공하지 않고 그대로 보여준다.
      setError(
        status === 409
          ? '이 판매자에는 이미 같은 채널이 있습니다.'
          : extractErrorMessage(e, '마스터를 만들지 못했습니다.'),
      );
    } finally {
      setCreating(false);
    }
  };

  const renderThumb = (p: Product) => {
    const src = getImageUrl(p.imageUrl, p.id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={p.productName}
        className="h-10 w-10 rounded border border-gray-200 object-cover"
      />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-gray-100 text-[10px] text-gray-400">
        없음
      </div>
    );
  };

  const busy = looking || creating;

  return (
    <PageContainer title="쿠팡 상품으로 마스터 추가">
      <Card className="space-y-4">
        {/* ① 판매자 · 마켓 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-gray-600"
              htmlFor="from-channel-seller"
            >
              판매자
            </label>
            <select
              id="from-channel-seller"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              value={sellerId}
              disabled={busy}
              onChange={(e) => setSellerId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">판매자를 선택하세요</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sellerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-gray-600"
              htmlFor="from-channel-platform"
            >
              마켓
            </label>
            <select
              id="from-channel-platform"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              value={platform}
              disabled={busy || PLATFORMS.length === 1}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ② 쿠팡 상품 ID */}
        <div className="flex items-end gap-2">
          <div className="w-64">
            <Input
              id="from-channel-product-id"
              label="쿠팡 상품 ID"
              size="sm"
              inputMode="numeric"
              disabled={busy}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleLookup();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleLookup()}
            disabled={sellerId === '' || productId.trim() === '' || busy}
          >
            {looking ? <Spinner label="조회 중…" /> : '조회'}
          </Button>
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {preview == null && (
          <p className="text-[11px] text-gray-500">
            판매자와 쿠팡 상품 ID 를 넣고 [조회]하면 옵션·가격·재고를 쿠팡에서 가져옵니다.
          </p>
        )}
      </Card>

      {preview && (
        <>
          {/* ③ 상품 정보(읽기 전용) */}
          <Card title="상품 정보" className="space-y-2">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{preview.productName ?? '(이름 없음)'}</span>
              <span className="text-gray-500">
                {' '}
                · {STATUS_LABEL[preview.status] ?? preview.status} · 옵션 {preview.options.length}개
                {preview.categoryCode && ` · 쿠팡 카테고리 코드 ${preview.categoryCode}`}
              </span>
            </p>

            {/* ④ 카테고리 */}
            {preview.categoryResolved ? (
              <p className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                쿠팡 카테고리: {preview.suggestedCategoryName ?? `#${preview.suggestedCategoryId}`}
              </p>
            ) : (
              <div>
                <p className="mb-1 text-xs text-amber-700">
                  쿠팡 카테고리에 연결된 표준 카테고리가 없습니다. 아래에서 직접 선택하세요(필수).
                </p>
                <CategoryTreeColumns
                  browse={browseTree}
                  selectedId={categoryId === '' ? null : categoryId}
                  onSelectLeaf={(leaf) => {
                    setCategoryId(leaf.id);
                    setCategoryName(leaf.name);
                  }}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  선택: {categoryName || '—'}
                </p>
              </div>
            )}
          </Card>

          {/* ⑤ 마스터 이름 */}
          <Card title="마스터 이름">
            <Input
              id="from-channel-master-name"
              size="sm"
              value={masterName}
              disabled={busy}
              onChange={(e) => setMasterName(e.target.value)}
              hint="쿠팡 상품명을 기본값으로 채웁니다. 수정할 수 있습니다."
            />
          </Card>

          {/* ⑥ 구성상품 선택 */}
          <Card title={`구성상품 (${selectedIds.length}개 선택)`} className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                placeholder="상품명으로 검색"
                value={productFilter}
                disabled={busy}
                onChange={(e) => setProductFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProductSearch();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleProductSearch}
                disabled={busy || productFilter.trim() === ''}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                검색
              </button>
            </div>

            {productHasSearched && (
              <div className="max-h-40 overflow-y-auto rounded border border-gray-200">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {searchResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          disabled={busy}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {renderThumb(p)}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-gray-800">
                              {p.productName}
                            </span>
                            <span className="block truncate text-[11px] text-gray-400">
                              {p.brand || '—'} · {formatWon(p.price)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {searchMatches.length > searchResults.length && (
                  <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                    {searchMatches.length}개 중 {searchResults.length}개 표시 — 더 구체적으로
                    검색하세요.
                  </p>
                )}
              </div>
            )}

            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {selectedProducts.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">선택된 상품이 없습니다.</li>
              ) : (
                selectedProducts.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                    {renderThumb(p)}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{p.productName}</span>
                      <span className="block truncate text-[11px] text-gray-400">
                        {p.brand || '—'} · {formatWon(p.price)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      disabled={busy}
                      aria-label="구성상품 제거"
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>

          {/* ⑦ 옵션 × 구성상품 수량 */}
          <Card title="옵션별 구성 수량" className="space-y-2">
            {selectedIds.length === 0 ? (
              <p className="text-sm text-gray-500">
                구성상품을 선택하면 옵션마다 수량을 입력할 수 있습니다.
              </p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">쿠팡 옵션</th>
                      <th className="px-2 py-1.5 text-right font-medium">판매가</th>
                      <th className="px-2 py-1.5 text-right font-medium">재고</th>
                      {selectedProducts.map((p) => (
                        <th key={p.id} className="px-2 py-1.5 text-right font-medium">
                          {p.productName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.options.map((o) => {
                      const key = optionKey(o);
                      const row = quantities[key] ?? {};
                      return (
                        <tr key={key} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 text-gray-900">{o.itemName}</td>
                          <td className="px-2 py-1.5 text-right text-gray-600">
                            {o.salePrice.toLocaleString('ko-KR')}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-600">
                            {o.stockQuantity ?? '—'}
                          </td>
                          {selectedProducts.map((p) => (
                            <td key={p.id} className="px-2 py-1.5 text-right">
                              <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${o.itemName} · ${p.productName} 수량`}
                                disabled={busy}
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100"
                                value={row[p.id] ?? ''}
                                onChange={(e) => setQuantity(key, p.id, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-500">
              수량은 1 이상의 정수입니다. 옵션명·판매가·재고는 쿠팡 값을 그대로 사용합니다.
            </p>
          </Card>

          {/* ⑧ 속성·고시 미리보기(접힘) */}
          <Card className="space-y-2">
            <button
              type="button"
              onClick={() => setMetaOpen((v) => !v)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {metaOpen ? '▾' : '▸'} 쿠팡 속성 · 고시 미리보기
            </button>
            {metaOpen && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">공통 속성 (마스터에 저장)</p>
                  <MetaList entries={preview.commonAttributes} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">
                    상품정보제공고시
                    {preview.noticeGroup && ` · ${preview.noticeGroup}`} (마스터에 저장)
                  </p>
                  <MetaList entries={preview.notices} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">
                    옵션별 속성 (각 마스터 옵션에 저장)
                  </p>
                  <ul className="space-y-2">
                    {preview.options.map((o) => (
                      <li key={optionKey(o)} className="rounded border border-gray-200 p-2">
                        <p className="text-sm text-gray-900">{o.itemName}</p>
                        <MetaList entries={o.attributes} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(ROUTES.MASTER_PRODUCTS)}
                disabled={busy}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={busy || blockReason != null}
              >
                {creating ? <Spinner label="만드는 중…" /> : '마스터 만들기'}
              </Button>
            </div>
            {!busy && blockReason && <p className="text-[11px] text-gray-500">{blockReason}</p>}
          </div>
        </>
      )}
    </PageContainer>
  );
}

/** 읽기 전용 키·값 목록(쿠팡에서 가져온 값). 비어 있으면 그 사실을 말한다. */
function MetaList({ entries }: { entries: Record<string, string> | null | undefined }) {
  const rows = Object.entries(entries ?? {});
  if (rows.length === 0) return <p className="text-[11px] text-gray-400">없음</p>;
  return (
    <ul className="space-y-0.5">
      {rows.map(([k, v]) => (
        <li key={k} className="text-[13px] text-gray-700">
          <span className="text-gray-500">{k}</span> · {v}
        </li>
      ))}
    </ul>
  );
}
