'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { MasterProductCreateForm } from './MasterProductCreateForm';
import { MarketSourceCard } from './MarketSourceCard';
import type { MarketSource } from './marketSource';

/** 「새 마스터」 모드의 출발 상품 조회 상태(2609_79). `idle` = 마켓 모드가 아니다. */
type MarketLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; market: MarketSource };

/**
 * 「판매 상품 관리 마스터」 = 판매상품 마스터 **새로 만들기** 페이지 진입점 (2609_78 / UX D41·D46·D61).
 * File: src/app/dashboard/master-products/new/components/MasterProductCreateContainer.tsx
 *
 * 진입점 3곳: 좌측 네비 `판매상품 > 판매 상품 관리 마스터` · 물품 등록 완료 창 [이 물품으로 마스터 만들기] ·
 * 마스터 바구니 [마스터 만들기]. 뒤의 둘은 `?productIds=1,2,3` 으로 구성상품을 골라 둔 채 들어온다.
 * ⚠️ 목록(`MasterProductList`)에 [마스터 추가] 버튼을 다시 넣지 말 것.
 *
 * ⚠️ 완료 화면이 없다(2609_78 / UX S3): 저장하면 「마스터를 만들었습니다」 알림과 함께 **그 마스터 상세로
 * 바로 간다** — `?overview=1` 로 [상품 관계 한눈에 보기]가 열린 채로(UX D69). 후속 저장 일부 실패는
 * 지금처럼 `?notice=` 배너로 넘긴다. 연달아 만들 때는 메뉴에서 다시 연다.
 *
 * 2609_79 / UX D70·D71·D77: 진입점 4번째 = 「마켓 상품으로 시작」 [새 마스터로]. 주소에
 * `?sellerId=&platform=&platformProductId=` 가 모두 있으면 마켓 상품을 한 번 조회해 폼을 채우고(사진 제외),
 * 저장 뒤 그 상품을 판매상품으로 붙인다. 조회가 끝나기 전에는 폼을 그리지 않는다(초기값이 조회 결과다).
 */
export function MasterProductCreateContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?productIds=` = 골라 둘 구성상품 id 목록(쉼표). 양의 정수만 · 중복 제거 · 첫 등장 순서.
  // 🔴 문자열로 memo 한다 — 매 렌더 새 배열을 넘기면 폼의 후보 로드 effect 가 매번 다시 돈다.
  const productIdsParam = searchParams.get('productIds') ?? '';
  const initialProductIds = useMemo(() => parseProductIds(productIdsParam), [productIdsParam]);
  // 2609_79: 마켓 모드 판정 — 세 값이 모두 유효할 때만. 하나라도 없으면 지금과 같은 새로 만들기다.
  const sellerIdParam = Number(searchParams.get('sellerId') ?? '');
  const platformParam = (searchParams.get('platform') ?? '').trim();
  const platformProductIdParam = (searchParams.get('platformProductId') ?? '').trim();
  const isMarketMode =
    Number.isInteger(sellerIdParam) &&
    sellerIdParam > 0 &&
    platformParam !== '' &&
    platformProductIdParam !== '';
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const [marketLoad, setMarketLoad] = useState<MarketLoad>(
    isMarketMode ? { status: 'loading' } : { status: 'idle' },
  );
  useEffect(() => {
    if (!isMarketMode) return;
    let alive = true;
    // Inline async IIFE defers all setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      setMarketLoad({ status: 'loading' });
      try {
        const preview = await listingUseCase.masterFromChannelPreview({
          sellerId: sellerIdParam,
          platform: platformParam,
          platformProductId: platformProductIdParam,
        });
        if (!alive) return;
        setMarketLoad({
          status: 'ready',
          market: {
            sellerId: sellerIdParam,
            platform: platformParam,
            platformProductId: platformProductIdParam,
            preview,
          },
        });
      } catch (e) {
        if (alive) {
          setMarketLoad({
            status: 'error',
            message: extractErrorMessage(e, '마켓 상품을 조회하지 못했습니다.'),
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [isMarketMode, sellerIdParam, platformParam, platformProductIdParam, listingUseCase]);
  // 주소에서 마켓 값이 빠지면(메뉴로 다시 들어옴) 이전 조회 결과를 쓰지 않는다 — 렌더 시점에 판정한다.
  const load: MarketLoad = isMarketMode ? marketLoad : { status: 'idle' };

  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const carrierRateUseCase = useMemo(
    () => new CarrierRateUseCase(new CarrierRateRepositoryImpl()),
    [],
  );
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);
  const thumbnailTemplateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );
  const detailUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );
  const productImageUseCase = useMemo(
    () => new ProductImageUseCase(new ProductImageRepositoryImpl()),
    [],
  );
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);
  // 2609_78/D50·D52: [상품 관계 한눈에 보기] — 기본은 가운데(폼)만, 누르면 왼쪽 물품 패널이 열린다.
  const [overviewOpen, setOverviewOpen] = useState(false);

  const handleCreated = useCallback(
    (masterId: number) => {
      toast.success('마스터를 만들었습니다.');
      router.push(`${ROUTES.MASTER_PRODUCT_DETAIL(masterId)}?overview=1`);
    },
    [router],
  );

  const handleCreatedWithWarning = useCallback(
    (masterId: number, warning: string) => {
      // 마스터는 만들어졌다 — 알림은 같고, 무엇을 마저 채울지는 상세 배너(`?notice=`)가 말한다.
      toast.success('마스터를 만들었습니다.');
      router.push(
        `${ROUTES.MASTER_PRODUCT_DETAIL(masterId)}?notice=${encodeURIComponent(warning)}&overview=1`,
      );
    },
    [router],
  );

  const handleCancel = useCallback(() => {
    router.push(ROUTES.MASTER_PRODUCTS);
  }, [router]);

  return (
    <PageContainer
      title="판매 상품 관리 마스터"
      action={
        <Button
          size="sm"
          variant={overviewOpen ? 'primary' : 'secondary'}
          aria-pressed={overviewOpen}
          onClick={() => setOverviewOpen((open) => !open)}
        >
          상품 관계 한눈에 보기
        </Button>
      }
    >
      {load.status === 'loading' && (
        <div className="flex min-h-32 items-center justify-center">
          <Spinner size={24} label="마켓 상품을 불러오는 중..." />
        </div>
      )}
      {load.status === 'error' && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{load.message}</p>
          <Link
            href={ROUTES.MASTER_PRODUCT_NEW_FROM_CHANNEL}
            className="mt-1 inline-block font-medium text-blue-600 hover:underline"
          >
            마켓 상품으로 시작으로 돌아가기
          </Link>
        </div>
      )}
      {load.status === 'ready' && <MarketSourceCard market={load.market} />}
      {(load.status === 'idle' || load.status === 'ready') && (
        <MasterProductCreateForm
          // 🔴 마켓 값은 폼의 초기값이다 — 출발 상품이 바뀌거나 없어지면 폼을 새로 마운트한다.
          key={load.status === 'ready' ? `market-${load.market.platformProductId}` : 'plain'}
          market={load.status === 'ready' ? load.market : undefined}
          useCase={useCase}
          productsUseCase={productsUseCase}
          carrierRateUseCase={carrierRateUseCase}
          packageUseCase={packageUseCase}
          thumbnailTemplateUseCase={thumbnailTemplateUseCase}
          detailUseCase={detailUseCase}
          productImageUseCase={productImageUseCase}
          categoryUseCase={categoryUseCase}
          initialProductIds={initialProductIds}
          overviewOpen={overviewOpen}
          onCreated={handleCreated}
          onCreatedWithWarning={handleCreatedWithWarning}
          onCancel={handleCancel}
        />
      )}
    </PageContainer>
  );
}

/** `"3,1,3,x,-2"` → `[3, 1]` — 양의 정수만 · 첫 등장 순서 · 중복 제거. 빈 문자열이면 `[]`. */
function parseProductIds(raw: string): number[] {
  const ids: number[] = [];
  for (const part of raw.split(',')) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
  }
  return ids;
}
