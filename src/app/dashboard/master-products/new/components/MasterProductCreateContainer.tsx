'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
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
 * 「판매상품 마스터 등록」 = the page that **creates** a new sales-product master (2609_78 / UX D41·D46·D61).
 * File: src/app/dashboard/master-products/new/components/MasterProductCreateContainer.tsx
 *
 * Three entries: left nav 「판매상품」 > 「판매상품 마스터 등록」 · product-registered dialog [이 물품으로 마스터 만들기] ·
 * master basket [마스터 만들기]. The last two arrive with components preselected via `?productIds=1,2,3`.
 * ⚠️ Do not add a [마스터 추가] button back to the list (`MasterProductList`).
 *
 * ⚠️ There is no completion screen (2609_78 / UX S3): saving shows the 「마스터를 만들었습니다」 toast and goes
 * **straight to that master's detail** with [상품 관계 한눈에 보기] open (`?overview=1`, UX D69). A partial
 * follow-up save failure is still handed over via the `?notice=` banner. To create another, reopen it from the menu.
 *
 * 2609_79 / UX D70·D71·D77: the fourth entry = [새 마스터로] on the 「마켓 상품으로 등록」 page. When the URL has
 * all of `?sellerId=&platform=&platformProductId=`, the market product is looked up once to fill the form
 * (photos excluded), and after saving that product is attached as a listing. The form is not drawn until the
 * lookup ends (its initial value is the lookup result).
 *
 * FEATURE_2610_35 / D3·D6·D17: the 「마켓 상품으로 등록」 page has no menu item — it is entered from this page's
 * title-row [마켓 상품으로 등록] button. The button is disabled in market mode (loading · error · ready) and asks
 * before leaving when the form has input (name or picked components).
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
  // FEATURE_2610_35 / D14: whether the form has input (name or picked components) — reported by the form.
  const [formHasInput, setFormHasInput] = useState(false);
  // FEATURE_2610_35 / D8: the leave confirm of [마켓 상품으로 등록].
  const [marketConfirmOpen, setMarketConfirmOpen] = useState(false);

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

  const goToMarketEntry = useCallback(() => {
    router.push(ROUTES.MASTER_PRODUCT_NEW_FROM_CHANNEL);
  }, [router]);

  // FEATURE_2610_35 / D17: no input = go now · input = confirm first (the button is disabled in market mode).
  const handleMarketEntry = useCallback(() => {
    if (formHasInput) {
      setMarketConfirmOpen(true);
      return;
    }
    goToMarketEntry();
  }, [formHasInput, goToMarketEntry]);

  return (
    <PageContainer
      title="판매상품 마스터 등록"
      action={
        <div className="flex items-center gap-2 max-md:flex-wrap">
          <Button
            size="sm"
            variant={overviewOpen ? 'primary' : 'secondary'}
            aria-pressed={overviewOpen}
            onClick={() => setOverviewOpen((open) => !open)}
          >
            상품 관계 한눈에 보기
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isMarketMode}
            title={isMarketMode ? '이미 마켓 상품을 불러온 상태입니다' : undefined}
            onClick={handleMarketEntry}
          >
            마켓 상품으로 등록
          </Button>
        </div>
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
            다시 조회하기
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
          onDirtyChange={setFormHasInput}
        />
      )}
      <ConfirmDialog
        isOpen={marketConfirmOpen}
        title="마켓 상품으로 등록"
        message="작성 중인 내용이 저장되지 않고 사라집니다. 마켓 상품으로 등록 화면으로 이동하시겠습니까?"
        confirmText="이동"
        cancelText="계속 작성"
        isDangerous
        onConfirm={goToMarketEntry}
        onCancel={() => setMarketConfirmOpen(false)}
      />
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
