'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { toast } from '@/infrastructure/stores/toastStore';
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
 */
export function MasterProductCreateContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?productIds=` = 골라 둘 구성상품 id 목록(쉼표). 양의 정수만 · 중복 제거 · 첫 등장 순서.
  // 🔴 문자열로 memo 한다 — 매 렌더 새 배열을 넘기면 폼의 후보 로드 effect 가 매번 다시 돈다.
  const productIdsParam = searchParams.get('productIds') ?? '';
  const initialProductIds = useMemo(() => parseProductIds(productIdsParam), [productIdsParam]);

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
      <MasterProductCreateForm
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
