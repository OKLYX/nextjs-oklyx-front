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
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import { DetailImageGroupRepositoryImpl } from '@/infrastructure/repositories/DetailImageGroupRepositoryImpl';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import {
  EMPTY_SHIPPING_OVERRIDE,
  overrideToMap,
  type ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import {
  MasterImagePool,
  type ImageField,
  type ImageFieldFilter,
  type MasterImageBuffer,
} from '../../components/MasterImagePool';
import { deriveMasterImageFields } from '../../components/masterImageFields';
import { commitMasterImageBuffer } from '../../components/masterImageCommit';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { Product } from '@/domain/entities/Product';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
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

/**
 * 오늘 지원하는 플랫폼은 쿠팡 하나다(D17: 플랫폼이 늘면 여기 한 줄만 는다).
 *
 * 조회에 필요한 입력은 **플랫폼마다 다르다** — 그 이름과 입력 방식을 여기서 함께 선언하고
 * 화면은 선택된 플랫폼의 값을 그대로 쓴다(네이버는 숫자가 아닌 `채널상품번호` 를 쓴다).
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

// 2609_47/D1: 이제 이 경로도 자동생성(썸네일·상세)을 끝낸 상태로 만들어진다 — 기존 가져오기로
// 만든 셀과 같다. 뒤에 붙는 저장(②~④)이 실패했을 때만 무엇이 비었는지 알려준다.
const SUCCESS_NOTICE = '마스터와 채널이 만들어졌습니다.';
const IMAGE_FAIL_NOTICE = '마스터·옵션은 만들어졌습니다. 이미지 반영에 실패했습니다.';
const SHIPPING_FAIL_NOTICE =
  '마스터는 만들어졌습니다. 배송 설정 저장에 실패했습니다(상세에서 재지정).';
const ASSETS_FAIL_NOTICE =
  '마스터는 만들어졌습니다. 썸네일·상세 생성에 실패했습니다(상세에서 [재생성]).';

const PRODUCT_SEARCH_LIMIT = 50;

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

/** 옵션 식별 키. 미승인 옵션은 마켓 옵션 id 가 없어 itemName 으로 대신한다(서버 매칭 규칙과 동일). */
const optionKey = (o: MasterFromChannelOption) => o.platformOptionId ?? o.itemName;

/**
 * 백엔드 문구를 가공하지 않고 그대로 쓰되, 사용자가 조치할 수 있는 것만 한 줄을 덧붙인다.
 * 판정은 HTTP status + substring — 프론트에는 예외 클래스명이 오지 않는다.
 * ⚠️ 문구는 백엔드 `DetachedCellPolicy` 소유다. 바꾸려면 그쪽을 먼저 본다.
 */
const lookupErrorMessage = (e: unknown): string => {
  const status = (e as { response?: { status?: number } })?.response?.status;
  const message = extractErrorMessage(e, '상품을 조회하지 못했습니다.');
  if (status === 429) return '잠시 후 다시 시도하세요.';
  if (status === 400 && message.includes('이미 다른 상품에 연결된')) {
    // 2609_66: 떼어낸 셀은 이제 통과한다 → 이 400 은 "아직 붙어 있다"는 뜻뿐이다.
    // 🔴 라벨은 화면에 있는 그대로 [마스터 연결 해제] 다(CellActions.tsx:407·526). 기존 모달의 같은 줄과도 맞춘다.
    return `${message} 그 마스터에서 [마스터 연결 해제] 한 뒤 다시 시도하세요.`;
  }
  if (status === 400 && message.includes('다른 판매자의')) {
    return `${message} 위에서 판매자를 바꿔 다시 조회하세요.`;
  }
  if (status === 400 && message.includes('계정')) {
    return `${message} 판매자 관리에서 쿠팡 계정을 먼저 등록·활성화하세요.`;
  }
  if (status === 404) {
    // 🔴 404 를 substring 으로 판정하지 말 것 — 백엔드가 영문으로 보낸다
    // (`MarketplaceAccount not found with id: 7`) → '계정' 이 들어 있지 않아 기존 모달의 그 가지는 죽어 있다.
    // 이 화면에서 404 를 던지는 것은 판매자·계정 둘뿐이라 문구 하나로 덮인다.
    return '이 판매자의 쿠팡 계정을 찾을 수 없습니다. 판매자 관리에서 먼저 등록·활성화하세요.';
  }
  return message;
};

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
  const carrierRateUseCase = useMemo(
    () => new CarrierRateUseCase(new CarrierRateRepositoryImpl()),
    [],
  );
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);
  const detailUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );
  const groupUseCase = useMemo(
    () => new DetailImageGroupUseCase(new DetailImageGroupRepositoryImpl()),
    [],
  );
  const productImageUseCase = useMemo(
    () => new ProductImageUseCase(new ProductImageRepositoryImpl()),
    [],
  );
  // ⚠️ 배송 설정(③)은 **마스터용** updateShippingOverride 다(셀용은 ListingRegistrationUseCase).
  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );

  // ① 판매자 · 플랫폼
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [platform, setPlatform] = useState(PLATFORMS[0].value);

  // ② 플랫폼 상품 식별자(이름·입력 방식은 선택된 플랫폼이 정한다)
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

  // 이미지: 칸(대표사진 + 상세 zone) 도출 + 생성 버퍼. 마스터가 아직 없어 버퍼로 들고 있다가
  // 만들어진 뒤 반영한다(D7 ②).
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  const [imageFieldFilters, setImageFieldFilters] = useState<ImageFieldFilter[]>([]);
  // 기본 템플릿이 요구하는 zone 만 필수(대표사진·비기본 템플릿 zone 은 선택).
  const [requiredZoneKeys, setRequiredZoneKeys] = useState<string[]>([]);
  const [imageBuffer, setImageBuffer] = useState<MasterImageBuffer>({ files: [], assignments: {} });

  // 기본 택배비·상자비(판매가 계산의 원가) — 생성 시 필수. 초기값은 후보 로드 IIFE 에서 프리셀렉트.
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [defaultDeliveryId, setDefaultDeliveryId] = useState<number | ''>('');
  const [defaultPackageId, setDefaultPackageId] = useState<number | ''>('');

  // 전 채널 공통 배송 설정. 비우면 판매채널의 기본값을 그대로 쓴다.
  const [shippingOverride, setShippingOverride] =
    useState<ShippingOverride>(EMPTY_SHIPPING_OVERRIDE);

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
        const [sellerList, prod, rates, boxes] = await Promise.all([
          sellerUseCase.getAll(),
          productsUseCase.getProducts({ page: 0, size: 1000 }),
          carrierRateUseCase.getCarrierRates(),
          // 🔴 판매가 계산용 상자 후보 = 구매 상자만. 재활용 상자는 비용 0 이라 기본 상자로 뽑히면
          //    원가 0 으로 판매가가 계산된다(생성 폼과 같은 규칙).
          packageUseCase.getPackages('PURCHASED'),
        ]);
        if (!alive) return;
        setSellers(sellerList);
        setProducts(prod.content);
        setCarrierRates(rates);
        setPackages(boxes);
        // 기본값 프리셀렉트. 없으면 미선택으로 두고 사용자가 고르게 한다(임의로 첫 항목 금지).
        // ⚠️ 별도 useEffect + setState 는 react-hooks/set-state-in-effect 위반이라 이 IIFE 안에서.
        setDefaultDeliveryId(rates.find((r) => r.isDefault)?.id ?? '');
        setDefaultPackageId(boxes.find((b) => b.isDefault)?.id ?? '');
      } catch {
        if (alive) setError('판매자·구성상품·택배/상자 후보를 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase, productsUseCase, carrierRateUseCase, packageUseCase]);

  // 이미지 칸 = 대표사진 + 상세 이미지 그룹 카탈로그. 도출 규칙은 생성 폼과 공유하는 헬퍼가 소유한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      const derived = await deriveMasterImageFields(detailUseCase, groupUseCase);
      if (!alive) return;
      setImageFields(derived.fields);
      setImageFieldFilters(derived.fieldFilters);
      setRequiredZoneKeys(derived.requiredZoneKeys);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, groupUseCase]);

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

  // 이미지 풀의 [제품 이미지] 탭 소스. ⚠️ `productImageUseCase` 와 이 배열이 **둘 다** 있어야 탭이 뜬다.
  const sourceProducts = useMemo(
    () => selectedProducts.map((p) => ({ id: p.id, name: p.productName })),
    [selectedProducts],
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
      setError(lookupErrorMessage(e));
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
              : defaultDeliveryId === '' || defaultPackageId === ''
                ? '기본 택배비와 기본 상자비를 선택하세요.'
                : null;

  /** 만들어진 마스터 상세로 이동. 뒤이은 저장이 실패했으면 그 사유를 배너로 넘긴다. */
  const goToMaster = (masterProductId: number, notice: string) =>
    router.push(
      `${ROUTES.MASTER_PRODUCT_DETAIL(masterProductId)}?notice=${encodeURIComponent(notice)}`,
    );

  /**
   * 저장 순서(2609_47/D7) = ① 만들기 → ② 사진 반영 → ③ 배송 설정 → ④ 자동생성 다시 → ⑤ 이동.
   *
   * ⚠️ **④가 핵심이다.** 서버는 ①에서 자동생성을 한 번 시도하지만 그때는 아직 사진이 없다(사진은
   * 마스터가 생긴 뒤에야 저장된다). ④를 빠뜨리면 썸네일·상세가 빈 채로 남는다.
   *
   * ⚠️ ①의 서버측 자동생성을 "중복이니 빼자"고 하지 말 것 — 화면을 거치지 않는 직접 호출과
   * ②~④ 도중 사용자가 나가버린 경우를 그것이 덮는다. 렌더가 두 번 도는 비용은 수용한다.
   *
   * ②·③·④ 실패는 생성을 되돌리지 않는다 — 각각 다른 안내로 상세 화면에 넘긴다.
   */
  const handleCreate = async () => {
    if (preview == null || sellerId === '' || categoryId === '' || blockReason != null || creating) {
      return;
    }
    // 기본 템플릿이 요구하는 상세 칸은 사진이 1장 이상 있어야 한다(버튼은 살아 있고 여기서 막는다).
    // 파일 업로드분 + 제품 사진 참조분을 합산한다.
    for (const zoneKey of requiredZoneKeys) {
      const fileCount = imageBuffer.assignments[zoneKey]?.length ?? 0;
      const productCount = imageBuffer.productAssignments?.[zoneKey]?.length ?? 0;
      if (fileCount + productCount < 1) {
        setError(`상세 이미지(${zoneKey})를 1장 이상 매핑하세요.`);
        return;
      }
    }
    setCreating(true);
    setError('');
    let created: { masterProductId: number; productListingId: number; assetsGenerated?: boolean };
    try {
      created = await listingUseCase.createMasterFromChannel({
        sellerId,
        platform,
        platformProductId: productId.trim(),
        masterName: masterName.trim(),
        categoryId,
        componentProductIds: selectedIds,
        defaultDeliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
        defaultPackageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
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
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // 400 은 전부 사람이 읽을 문구로 온다 → 가공하지 않고 그대로 보여준다.
      setError(
        status === 409
          ? '이 판매자에는 이미 같은 채널이 있습니다.'
          : extractErrorMessage(e, '마스터를 만들지 못했습니다.'),
      );
      setCreating(false);
      return;
    }

    // ② 사진 반영 — 여기부터는 마스터가 이미 존재한다. 실패해도 되돌리지 않는다.
    const mappedImages =
      imageBuffer.files.length > 0 ||
      Object.values(imageBuffer.assignments).some((v) => v.length > 0) ||
      Object.values(imageBuffer.productAssignments ?? {}).some((v) => v.length > 0);
    try {
      await commitMasterImageBuffer(detailUseCase, created.masterProductId, imageBuffer);
    } catch {
      goToMaster(created.masterProductId, IMAGE_FAIL_NOTICE);
      return;
    }

    // ③ 배송 설정(전 채널 공통) — 비어 있으면 호출하지 않는다.
    const shippingMap = overrideToMap(shippingOverride);
    if (Object.keys(shippingMap).length > 0) {
      try {
        await masterUseCase.updateShippingOverride(created.masterProductId, {
          override: shippingMap,
        });
      } catch {
        goToMaster(created.masterProductId, SHIPPING_FAIL_NOTICE);
        return;
      }
    }

    // ④ 사진이 붙은 뒤 자동생성을 다시 돌린다. 반영한 사진이 하나도 없고 ①이 이미 성공했다면
    //    바뀐 게 없으므로 건너뛴다(그때는 ①의 결과가 곧 최신이다).
    if (!mappedImages && created.assetsGenerated === true) {
      goToMaster(created.masterProductId, SUCCESS_NOTICE);
      return;
    }
    try {
      await listingUseCase.regenerate(created.productListingId);
    } catch {
      goToMaster(created.masterProductId, ASSETS_FAIL_NOTICE);
      return;
    }
    goToMaster(created.masterProductId, SUCCESS_NOTICE);
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

  /** 선택된 플랫폼의 입력 정의. 화면 문구·입력 방식이 전부 여기서 나온다. */
  const platformMeta = useMemo(
    () => PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0],
    [platform],
  );

  /** 플랫폼을 바꾸면 식별자의 뜻이 달라지므로 입력과 이전 조회 결과를 함께 버린다. */
  const handlePlatformChange = (next: string) => {
    setPlatform(next);
    setProductId('');
    setPreview(null);
    setError('');
  };

  const busy = looking || creating;

  return (
    <PageContainer title="플랫폼 상품으로 마스터 추가">
      <Card className="space-y-4">
        {/* ① 판매자 · 플랫폼 */}
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
              플랫폼
            </label>
            <select
              id="from-channel-platform"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              value={platform}
              disabled={busy || PLATFORMS.length === 1}
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

        {/* ② 플랫폼 상품 식별자 — 라벨·입력 방식은 선택된 플랫폼이 정한다 */}
        <div className="flex items-end gap-2">
          <div className="w-64">
            <Input
              id="from-channel-product-id"
              label={platformMeta.idLabel}
              size="sm"
              inputMode={platformMeta.idNumeric ? 'numeric' : 'text'}
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
            판매자와 {platformMeta.idLabel} 를 넣고 [조회]하면 옵션·가격·재고를{' '}
            {platformMeta.label}에서 가져옵니다.
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

            {/* 2609_66/D6: 경고가 아니라 사실 안내라 카테고리 경고(amber)와 다른 색을 쓴다.
                뒷문장은 실제 동작이다 — 재사용은 판매가·옵션명을 쿠팡 현재값(MANUAL_OVERRIDE)으로 넣는다. */}
            {preview.reusesExistingListing && (
              <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                이 쿠팡 상품에는 마스터 연결이 끊긴 판매상품이 있습니다. 새로 만들지 않고 그 판매상품을 이
                마스터에 붙입니다 — 주문·고객문의·정산 기록이 함께 따라옵니다. 판매가·옵션명은 쿠팡의 현재
                값으로 들어오니, 이 마스터 기준으로 자동 계산하려면 만든 뒤 [가격 설정] → [기본값으로 변경]
                을 누르세요.
              </p>
            )}

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

          {/* ⑥-1 이미지 — 구성상품을 고르면 그 물품 사진이 왼쪽 [제품 이미지] 탭에 뜬다 */}
          <Card title="이미지 (대표사진 + 상세페이지)">
            <MasterImagePool
              masterId={null}
              detailUseCase={detailUseCase}
              fields={imageFields}
              fieldFilters={imageFieldFilters}
              buffer={imageBuffer}
              onBufferChange={setImageBuffer}
              productImageUseCase={productImageUseCase}
              sourceProducts={sourceProducts}
            />
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

          {/* ⑦-1 기본 택배비 · 상자비 (판매가 계산의 원가) */}
          <Card title="기본 택배비 · 상자비" className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-gray-600"
                  htmlFor="from-channel-delivery"
                >
                  기본 택배비 *
                </label>
                <select
                  id="from-channel-delivery"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                  value={defaultDeliveryId}
                  disabled={busy}
                  onChange={(e) =>
                    setDefaultDeliveryId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  {carrierRates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.carrier} {r.type} · {formatWon(r.cost)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-gray-600"
                  htmlFor="from-channel-package"
                >
                  기본 상자비 *
                </label>
                <select
                  id="from-channel-package"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                  value={defaultPackageId}
                  disabled={busy}
                  onChange={(e) => setDefaultPackageId(e.target.value ? Number(e.target.value) : '')}
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.type} · {formatWon(p.cost)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              옵션에서 개별 지정하지 않으면 이 값이 모든 옵션 판매가 계산에 쓰입니다. 판매가는 쿠팡
              값을 그대로 쓰므로 이 원가로 덮이지 않습니다.
            </p>
          </Card>

          {/* ⑦-2 배송 설정 (전 채널 공통) */}
          <Card title="배송 설정 (전 채널 공통)" className="space-y-2">
            <p className="text-[11px] text-gray-500">
              비우면 판매채널의 기본 배송 설정을 그대로 씁니다. 채워두면 이 마스터의 모든 채널에
              적용되고, 채널마다 다르게 하려면 나중에 [채널 배송 설정]에서 바꿉니다. 출고지·반품지는
              판매채널마다 달라야 해서 여기서 지정하지 않습니다.
            </p>
            <ShippingOverrideFields
              level="master"
              scope="common"
              value={shippingOverride}
              onChange={setShippingOverride}
              platform={platform}
              disabled={busy}
            />
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
