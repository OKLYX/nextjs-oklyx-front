'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ImportCoupangProductModal } from '../../[id]/components/ImportCoupangProductModal';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { Product } from '@/domain/entities/Product';
import type { MasterFromChannelPreview } from '@/domain/entities/ListingRegistrationEntity';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';

// 상태 enum → 화면 문구(enum 원문을 사용자에게 노출하지 않는다). 가져오기 창과 같은 한 줄짜리 표지만,
// 서로 import 하면 화면 간 결합이 생기므로 지역으로 둔다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

/**
 * 오늘 지원하는 플랫폼은 쿠팡 하나다(D17 · UX D64: 플랫폼이 늘면 여기 한 줄만 는다).
 * ⚠️ 화면 JSX 에 플랫폼 이름을 직접 쓰지 말 것 — 플랫폼이 늘 때 고칠 자리가 흩어진다.
 */
type PlatformOption = {
  value: string;
  label: string;
  /** 상품 식별자 입력칸의 라벨 */
  idLabel: string;
  /** 식별자가 숫자만인지(모바일 키패드 힌트) */
  idNumeric: boolean;
};

const PLATFORMS: PlatformOption[] = [
  { value: 'COUPANG', label: '쿠팡', idLabel: '쿠팡 상품 ID', idNumeric: true },
];

/** 상품명에서 물품 후보를 찾을 때 쓰는 낱말 수 · 보여 줄 후보 수 · 검색 한 번의 크기(UX D79). */
const CANDIDATE_TOKEN_LIMIT = 5;
const CANDIDATE_LIMIT = 20;
const SEARCH_SIZE = 20;

/** 판별자: 이 문구가 들어간 400 = 이미 다른 마스터에 붙어 있는 상품(`DetachedCellPolicy` 소유 문구). */
const ALREADY_LINKED = '이미 다른 상품에 연결된';

/** 마스터 한 줄 = 이름 + 구성상품 조합(UX D74). 물품 기준 후보와 이름 검색 결과가 같은 모양으로 그린다. */
interface MasterRow {
  id: number;
  name: string;
  componentNames: string[];
}

/** 상품명 → 검색 낱말(공백으로 나눔 · 2글자 이상 · 중복 제거 · 앞에서 5개). */
const nameTokens = (name: string): string[] =>
  [...new Set(name.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2))].slice(
    0,
    CANDIDATE_TOKEN_LIMIT,
  );

/**
 * 백엔드 문구를 가공하지 않고 그대로 쓰되, 사용자가 조치할 수 있는 것만 한 줄을 덧붙인다.
 * 판정은 HTTP status + substring — 프론트에는 예외 클래스명이 오지 않는다.
 * ⚠️ 문구는 백엔드 `DetachedCellPolicy` · `MarketProductAccess` 소유다. 바꾸려면 그쪽을 먼저 본다.
 */
const lookupErrorMessage = (e: unknown): string => {
  const status = (e as { response?: { status?: number } })?.response?.status;
  const message = extractErrorMessage(e, '상품을 조회하지 못했습니다.');
  if (status === 429) return '잠시 후 다시 시도하세요.';
  if (status === 400 && message.includes(ALREADY_LINKED)) {
    return `${message} 옮기려면 그 마스터에서 [마스터 연결 해제] 한 뒤 다시 조회하세요.`;
  }
  if (status === 400 && message.includes('다른 판매자의')) {
    return `${message} 위에서 판매자를 바꿔 다시 조회하세요.`;
  }
  if (status === 400 && message.includes('계정')) {
    return `${message} 판매자 관리에서 쿠팡 계정을 먼저 등록·활성화하세요.`;
  }
  if (status === 404) {
    // 🔴 404 를 substring 으로 판정하지 말 것 — 백엔드가 영문으로 보낸다. 이 화면에서 404 는 판매자·계정뿐이다.
    return '이 판매자의 쿠팡 계정을 찾을 수 없습니다. 판매자 관리에서 먼저 등록·활성화하세요.';
  }
  return message;
};

/**
 * 「마켓 상품으로 시작」 (FEATURE_2609_45 → 2609_79 / UX D64·D72~D75·D79).
 * File: src/app/dashboard/master-products/new-from-channel/components/MasterFromChannelForm.tsx
 *
 * 순서: 판매자·판매채널·상품 ID → [조회] → 상품 정보 → 이 상품에 든 물품 고르기(상품명으로 후보 · 직접 검색)
 * → 고른 물품이 하나라도 들어간 마스터 전부(물품 조합과 함께) → [이 마스터에 붙이기] / [새 마스터로].
 * [기존 마스터에 붙이기] 는 마스터 이름 검색을 연다(UX D75).
 *
 * - 이미 어떤 마스터에 붙은 상품이면 「이미 ○○ 마스터에 연결돼 있습니다」 + [그 마스터로 가기] 만 보인다(UX D81) —
 *   물품 후보 · 겹치는 마스터 · 붙이기 · [새 마스터로] 는 **마스터에 매핑되지 않은 상품일 때만** 나온다.
 * - [이 마스터에 붙이기] = 마스터 상세의 「마켓 상품 추가하기」 와 **같은 창**(`ImportCoupangProductModal`, UX D42·D78).
 *   붙이면 알림 「붙였습니다.」 + 그 마스터 상세로 간다(UX D75).
 * - [새 마스터로] = 3단 페이지(`/dashboard/master-products/new`)로 간다 — 판매자·판매채널·상품 ID + 고른 물품을
 *   주소에 싣는다. 3단 페이지가 다시 조회해 채우고, 저장 뒤 판매상품을 붙인다(UX D70·D77).
 * - ❌ 이 화면은 저장하지 않는다. 마스터·판매상품을 만드는 처리는 3단 페이지와 공유 창에만 있다.
 * - ⚠️ 미리보기 응답을 캐시하지 않는다(가격·재고는 변한다). 페이지를 떠나면 버린다.
 */
export function MasterFromChannelForm() {
  const router = useRouter();

  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );

  // ① 판매자 · 판매채널(UX D72 — 두 칸) · 상품 ID
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [platform, setPlatform] = useState(PLATFORMS[0].value);
  const [productId, setProductId] = useState('');

  // ② 조회 결과 — 조회한 순간의 판매자·판매채널·상품 ID 를 함께 든다(입력칸을 고쳐도 결과와 섞이지 않게).
  const [preview, setPreview] = useState<MasterFromChannelPreview | null>(null);
  const [lookedUp, setLookedUp] = useState<{
    sellerId: number;
    platform: string;
    platformProductId: string;
  } | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  // 이미 붙어 있는 상품이면 그 마스터(마스터 목록 검색 = 상품 ID 완전일치, UX D74 🔁 · D81).
  const [linkedMasters, setLinkedMasters] = useState<MasterRow[]>([]);
  // 조회 차례 번호 — 조회를 빠르게 두 번 하면 앞 상품의 물품 후보가 뒤 상품 화면을 덮지 않게 한다.
  const lookupSeq = useRef(0);

  // ③ 물품 고르기(UX D79)
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[] | null>(null);
  const [productSearching, setProductSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  // ④ 고른 물품이 들어간 마스터(UX D74)
  const [overlapMasters, setOverlapMasters] = useState<MasterRow[]>([]);
  const [overlapLoading, setOverlapLoading] = useState(false);
  const [overlapError, setOverlapError] = useState('');

  // ⑤ 마스터 이름 검색(UX D75)
  const [masterSearchOpen, setMasterSearchOpen] = useState(false);
  const [masterSearchInput, setMasterSearchInput] = useState('');
  const [masterSearchResults, setMasterSearchResults] = useState<MasterRow[] | null>(null);
  const [masterSearching, setMasterSearching] = useState(false);
  const [masterSearchError, setMasterSearchError] = useState('');

  // ⑥ 붙이기 창
  const [attachLoadingId, setAttachLoadingId] = useState<number | null>(null);
  const [attachTarget, setAttachTarget] = useState<{
    masterId: number;
    masterOptions: MasterOptionResponse[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await sellerUseCase.getAll();
        if (alive) setSellers(list);
      } catch {
        if (alive) setError('판매자 목록을 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase]);

  /** 선택된 플랫폼의 입력 정의. 화면 문구·입력 방식이 전부 여기서 나온다. */
  const platformMeta = useMemo(
    () => PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0],
    [platform],
  );

  /** 상품명 낱말마다 물품을 검색해, 많이 걸린 순으로 후보를 세운다(같으면 먼저 나온 순). */
  const loadCandidates = useCallback(
    async (productName: string, seq: number) => {
      const tokens = nameTokens(productName);
      if (tokens.length === 0) return;
      setCandidateLoading(true);
      setCandidateError('');
      const results = await Promise.allSettled(
        tokens.map((token) => productsUseCase.getProducts({ page: 0, size: SEARCH_SIZE, search: token })),
      );
      const score = new Map<number, { product: Product; hits: number; order: number }>();
      let order = 0;
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const product of result.value.content) {
          const seen = score.get(product.id);
          if (seen) seen.hits += 1;
          else score.set(product.id, { product, hits: 1, order: order++ });
        }
      }
      // 그 사이 다른 상품을 조회했으면 이 결과는 버린다(뒤 조회가 로딩 표시를 소유한다).
      if (seq !== lookupSeq.current) return;
      if (results.every((r) => r.status === 'rejected')) {
        setCandidateError('물품 후보를 불러오지 못했습니다. 아래에서 직접 검색하세요.');
      }
      setCandidates(
        [...score.values()]
          .sort((a, b) => b.hits - a.hits || a.order - b.order)
          .slice(0, CANDIDATE_LIMIT)
          .map((s) => s.product),
      );
      setCandidateLoading(false);
    },
    [productsUseCase],
  );

  /** 상품 ID 를 고쳐 다시 조회하면 이전 결과·물품 선택·마스터 후보를 함께 버린다. */
  const handleLookup = async () => {
    if (sellerId === '' || productId.trim() === '' || looking) return;
    const target = { sellerId, platform, platformProductId: productId.trim() };
    const seq = ++lookupSeq.current;
    setLooking(true);
    setCandidateLoading(false);
    setError('');
    setPreview(null);
    setLookedUp(null);
    setLinkedMasters([]);
    setCandidates([]);
    setCandidateError('');
    setProductSearchResults(null);
    setSelectedProducts([]);
    setOverlapMasters([]);
    setOverlapError('');
    setMasterSearchOpen(false);
    setMasterSearchResults(null);
    try {
      const res = await listingUseCase.masterFromChannelPreview(target);
      setPreview(res);
      setLookedUp(target);
      void loadCandidates(res.productName ?? '', seq);
    } catch (e: unknown) {
      setError(lookupErrorMessage(e));
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 400 && extractErrorMessage(e, '').includes(ALREADY_LINKED)) {
        // 어느 마스터에 붙어 있는지 알려 준다 — 마스터 목록 검색은 상품 ID 를 완전일치로 찾는다.
        try {
          const page = await masterUseCase.list({
            page: 0,
            size: SEARCH_SIZE,
            sort: 'createdAt,desc',
            search: target.platformProductId,
          });
          setLinkedMasters(
            page.content.map((m) => ({
              id: m.id,
              name: m.name,
              componentNames: m.components.map((c) => c.productName),
            })),
          );
        } catch {
          setLinkedMasters([]);
        }
      }
    } finally {
      setLooking(false);
    }
  };

  /** 물품을 고르거나 뺄 때마다 그 물품이 하나라도 들어간 마스터를 다시 불러온다(UX D74). */
  const refreshOverlap = useCallback(
    async (products: Product[]) => {
      setOverlapError('');
      if (products.length === 0) {
        setOverlapMasters([]);
        return;
      }
      setOverlapLoading(true);
      try {
        const rows = await masterUseCase.findByAnyComponent(products.map((p) => p.id));
        setOverlapMasters(
          rows.map((m) => ({
            id: m.id,
            name: m.name,
            componentNames: m.components.map((c) => c.productName),
          })),
        );
      } catch (e) {
        setOverlapMasters([]);
        setOverlapError(extractErrorMessage(e, '마스터 후보를 불러오지 못했습니다.'));
      } finally {
        setOverlapLoading(false);
      }
    },
    [masterUseCase],
  );

  const toggleProduct = (product: Product) => {
    const next = selectedProducts.some((p) => p.id === product.id)
      ? selectedProducts.filter((p) => p.id !== product.id)
      : [...selectedProducts, product];
    setSelectedProducts(next);
    void refreshOverlap(next);
  };

  const handleProductSearch = async () => {
    const query = productSearchInput.trim();
    if (query === '' || productSearching) return;
    setProductSearching(true);
    try {
      const res = await productsUseCase.getProducts({ page: 0, size: SEARCH_SIZE, search: query });
      setProductSearchResults(res.content);
    } catch {
      setProductSearchResults([]);
    } finally {
      setProductSearching(false);
    }
  };

  const handleMasterSearch = async () => {
    const query = masterSearchInput.trim();
    if (query === '' || masterSearching) return;
    setMasterSearching(true);
    setMasterSearchError('');
    try {
      const page = await masterUseCase.list({
        page: 0,
        size: SEARCH_SIZE,
        sort: 'createdAt,desc',
        search: query,
      });
      setMasterSearchResults(
        page.content.map((m) => ({
          id: m.id,
          name: m.name,
          componentNames: m.components.map((c) => c.productName),
        })),
      );
    } catch (e) {
      setMasterSearchResults([]);
      setMasterSearchError(extractErrorMessage(e, '마스터를 검색하지 못했습니다.'));
    } finally {
      setMasterSearching(false);
    }
  };

  /** [이 마스터에 붙이기] — 그 마스터의 옵션을 읽어 공유 창을 연다(창은 열리자마자 조회한다). */
  const openAttach = async (masterId: number) => {
    if (attachLoadingId != null) return;
    setAttachLoadingId(masterId);
    setError('');
    try {
      const master = await masterUseCase.getById(masterId);
      setAttachTarget({ masterId, masterOptions: master.options });
    } catch (e) {
      setError(extractErrorMessage(e, '마스터를 불러오지 못했습니다.'));
    } finally {
      setAttachLoadingId(null);
    }
  };

  /** 붙인 뒤 = 알림 + 그 마스터 상세(UX D75). 커밋에서 처음 온 카테고리 경고는 상세 배너로 넘긴다. */
  const handleAttached = (masterId: number, categoryWarning: string | null) => {
    toast.success('붙였습니다.');
    router.push(
      categoryWarning
        ? `${ROUTES.MASTER_PRODUCT_DETAIL(masterId)}?notice=${encodeURIComponent(categoryWarning)}`
        : ROUTES.MASTER_PRODUCT_DETAIL(masterId),
    );
  };

  /** [새 마스터로] — 3단 페이지로. 고른 물품은 구성상품 칸에 채워져 들어간다(UX D79 · 2609_78 `?productIds=`). */
  const goToNewMaster = () => {
    if (lookedUp == null) return;
    const params = new URLSearchParams({
      sellerId: String(lookedUp.sellerId),
      platform: lookedUp.platform,
      platformProductId: lookedUp.platformProductId,
    });
    if (selectedProducts.length > 0) {
      params.set('productIds', selectedProducts.map((p) => p.id).join(','));
    }
    router.push(`${ROUTES.MASTER_PRODUCT_NEW}?${params.toString()}`);
  };

  /** 플랫폼을 바꾸면 식별자의 뜻이 달라지므로 입력과 이전 조회 결과를 함께 버린다. */
  const handlePlatformChange = (next: string) => {
    setPlatform(next);
    setProductId('');
    setPreview(null);
    setLookedUp(null);
    setError('');
  };

  const sellerName = sellers.find((s) => s.id === lookedUp?.sellerId)?.sellerName ?? '';

  const renderMasterRows = (rows: MasterRow[]) => (
    <ul className="divide-y divide-gray-100 rounded border border-gray-200">
      {rows.map((m) => (
        <li key={m.id} className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1">
            <a
              href={ROUTES.MASTER_PRODUCT_DETAIL(m.id)}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {m.name}
            </a>
            <span className="block truncate text-[11px] text-gray-500">
              {m.componentNames.length > 0 ? m.componentNames.join(' + ') : '구성상품 없음'}
            </span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void openAttach(m.id)}
            disabled={attachLoadingId != null}
          >
            {attachLoadingId === m.id ? <Spinner label="여는 중…" /> : '이 마스터에 붙이기'}
          </Button>
        </li>
      ))}
    </ul>
  );

  const renderProductRow = (p: Product) => {
    const checked = selectedProducts.some((s) => s.id === p.id);
    return (
      <li key={p.id}>
        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-blue-50">
          <input type="checkbox" checked={checked} onChange={() => toggleProduct(p)} />
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
            {p.brand ? `${p.brand} ` : ''}
            {p.productName}
          </span>
        </label>
      </li>
    );
  };

  return (
    <PageContainer title="마켓 상품으로 시작">
      <Card className="space-y-4">
        {/* ① 판매자 · 판매채널 — 두 칸(UX D72) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="market-entry-seller">
              판매자
            </label>
            <select
              id="market-entry-seller"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              value={sellerId}
              disabled={looking}
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
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="market-entry-platform">
              판매채널
            </label>
            <select
              id="market-entry-platform"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              value={platform}
              disabled={looking || PLATFORMS.length === 1}
              onChange={(e) => handlePlatformChange(e.target.value)}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ② 상품 식별자 — 라벨·입력 방식은 선택된 플랫폼이 정한다 */}
        <div className="flex items-end gap-2">
          <div className="w-64">
            <Input
              id="market-entry-product-id"
              label={platformMeta.idLabel}
              size="sm"
              inputMode={platformMeta.idNumeric ? 'numeric' : 'text'}
              disabled={looking}
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
            disabled={sellerId === '' || productId.trim() === '' || looking}
          >
            {looking ? <Spinner label="조회 중…" /> : '조회'}
          </Button>
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {/* UX D81: 이미 붙은 상품 = 안내 + [그 마스터로 가기] 만. 붙이기는 서버가 400 으로 막으므로 버튼을 두지 않는다. */}
        {linkedMasters.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2"
          >
            <p className="text-sm text-amber-900">
              이미 <span className="font-medium">{m.name}</span> 마스터에 연결돼 있습니다.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(m.id))}
            >
              그 마스터로 가기
            </Button>
          </div>
        ))}

        {preview == null && !error && (
          <p className="text-[11px] text-gray-500">
            판매자와 {platformMeta.idLabel} 를 넣고 [조회]하면 {platformMeta.label}에서 상품을 읽어 옵니다.
          </p>
        )}
      </Card>

      {preview && lookedUp && (
        <>
          {/* ③ 상품 정보(읽기 전용) */}
          <Card title="상품 정보" className="mt-4 space-y-2">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{preview.productName ?? '(이름 없음)'}</span>
              <span className="text-gray-500">
                {' '}
                · {STATUS_LABEL[preview.status] ?? preview.status} · 옵션 {preview.options.length}개
              </span>
            </p>
            {preview.reusesExistingListing && (
              <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                이 상품에는 마스터 연결이 끊긴 판매상품이 있습니다. 새로 만들지 않고 그 판매상품을 붙입니다 —
                주문·고객문의·정산 기록이 함께 따라옵니다.
              </p>
            )}
          </Card>

          {/* ④ 이 상품에 든 물품 고르기(UX D79) */}
          <Card title={`이 상품에 든 물품 (${selectedProducts.length}개 선택)`} className="mt-4 space-y-2">
            <p className="text-[11px] text-gray-500">
              상품명으로 찾은 물품 후보입니다. 이 상품에 들어 있는 물품을 모두 고르세요 — 후보에 없으면 아래에서
              직접 검색합니다.
            </p>
            {candidateLoading ? (
              <Spinner label="물품 후보를 찾는 중…" />
            ) : candidates.length === 0 ? (
              <p className="text-sm text-gray-500">상품명으로 찾은 물품 후보가 없습니다.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded border border-gray-200">
                {candidates.map(renderProductRow)}
              </ul>
            )}
            {candidateError && <p className="text-[11px] text-red-700">{candidateError}</p>}

            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                placeholder="물품 이름으로 검색"
                value={productSearchInput}
                onChange={(e) => setProductSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleProductSearch();
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleProductSearch()}
                disabled={productSearching || productSearchInput.trim() === ''}
              >
                {productSearching ? <Spinner label="검색 중…" /> : '검색'}
              </Button>
            </div>
            {productSearchResults != null &&
              (productSearchResults.length === 0 ? (
                <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto rounded border border-gray-200">
                  {productSearchResults.map(renderProductRow)}
                </ul>
              ))}
          </Card>

          {/* ⑤ 고른 물품이 하나라도 들어간 마스터 전부(UX D74) */}
          <Card title="이 물품이 들어간 마스터" className="mt-4 space-y-2">
            {selectedProducts.length === 0 ? (
              <p className="text-sm text-gray-500">
                물품을 고르면 그 물품이 하나라도 들어간 마스터를 물품 조합과 함께 보여 줍니다.
              </p>
            ) : overlapLoading ? (
              <Spinner label="마스터를 찾는 중…" />
            ) : overlapMasters.length === 0 ? (
              <p className="text-sm text-gray-500">고른 물품이 들어간 마스터가 없습니다.</p>
            ) : (
              renderMasterRows(overlapMasters)
            )}
            {overlapError && <p className="text-[11px] text-red-700">{overlapError}</p>}
          </Card>

          {/* ⑥ 새 마스터로 / 기존 마스터에 붙이기(UX D73) */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setMasterSearchOpen((open) => !open)}>
              기존 마스터에 붙이기
            </Button>
            <Button onClick={goToNewMaster}>새 마스터로</Button>
          </div>

          {/* ⑦ 마스터 이름 검색(UX D75) */}
          {masterSearchOpen && (
            <Card title="마스터 찾기" className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  placeholder="마스터 이름 · 상품 ID · 옵션 ID"
                  value={masterSearchInput}
                  onChange={(e) => setMasterSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleMasterSearch();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleMasterSearch()}
                  disabled={masterSearching || masterSearchInput.trim() === ''}
                >
                  {masterSearching ? <Spinner label="검색 중…" /> : '검색'}
                </Button>
              </div>
              {masterSearchError && <p className="text-[11px] text-red-700">{masterSearchError}</p>}
              {masterSearchResults != null &&
                (masterSearchResults.length === 0 ? (
                  <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
                ) : (
                  renderMasterRows(masterSearchResults)
                ))}
            </Card>
          )}
        </>
      )}

      {attachTarget && lookedUp && (
        <ImportCoupangProductModal
          masterId={attachTarget.masterId}
          sellerId={lookedUp.sellerId}
          platform={lookedUp.platform}
          sellerName={sellerName}
          masterOptions={attachTarget.masterOptions}
          initialProductId={lookedUp.platformProductId}
          onClose={() => setAttachTarget(null)}
          onDone={(categoryWarning) => handleAttached(attachTarget.masterId, categoryWarning)}
        />
      )}
    </PageContainer>
  );
}
