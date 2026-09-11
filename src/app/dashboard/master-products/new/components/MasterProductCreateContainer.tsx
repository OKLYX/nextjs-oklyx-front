'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ROUTES } from '@/config/routes';
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
 * 판매상품 마스터 **생성 페이지** 진입점.
 * File: src/app/dashboard/master-products/new/components/MasterProductCreateContainer.tsx
 *
 * ⚠️ 2026-09-11: 생성 폼이 목록 페이지의 모달이었다가 이 페이지로 나왔다. 목록(`MasterProductList`)에
 * [마스터 추가] 버튼을 다시 넣지 말 것 — 진입점은 좌측 네비 `판매상품 > 판매상품 마스터 추가` 하나다.
 *
 * ⚠️ 완료 후 경로는 **3지선다이되 동등하지 않다**. 기본(primary)은 **상세로 이동**이다:
 * 생성 마법사는 수정을 하지 않으므로(편집 지점 = 상세) 생성 직후 할 일이 전부 상세에 있다.
 * 후속 저장이 일부 실패한 경우엔 3지선다를 건너뛰고 **상세로 직행**한다 — 무엇을 마저 채워야
 * 하는지 알 수 있는 화면이 상세뿐이기 때문이다.
 *
 * ⚠️ [새 마스터 추가]는 `formKey` 를 올려 폼을 **통째로 재마운트**한다. 상태를 하나씩 되돌리면
 * 이미지 풀 업로드 버퍼가 남아 다음 마스터에 섞인다.
 */
export function MasterProductCreateContainer() {
  const router = useRouter();

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

  // 생성 완료된 마스터 id. null 이면 폼, 값이 있으면 완료 화면.
  const [createdId, setCreatedId] = useState<number | null>(null);
  // 폼 재마운트 키 — [새 마스터 추가]가 올린다(버퍼까지 확실히 비우기 위해).
  const [formKey, setFormKey] = useState(0);

  const handleCreated = useCallback((masterId: number) => {
    setCreatedId(masterId);
  }, []);

  const handleCreatedWithWarning = useCallback(
    (masterId: number, warning: string) => {
      // 미완 상태 — 완료 화면을 거치지 않고 상세로 보낸다. 경고는 상세에서 배너로 보여준다.
      router.push(`${ROUTES.MASTER_PRODUCT_DETAIL(masterId)}?notice=${encodeURIComponent(warning)}`);
    },
    [router],
  );

  const handleCancel = useCallback(() => {
    router.push(ROUTES.MASTER_PRODUCTS);
  }, [router]);

  const handleAddAnother = useCallback(() => {
    setCreatedId(null);
    setFormKey((k) => k + 1);
  }, []);

  if (createdId != null) {
    return (
      <PageContainer title="판매상품 마스터 추가">
        <Card>
          <p className="text-sm text-gray-900">마스터가 생성되었습니다.</p>
          <p className="mt-1 text-sm text-gray-500">
            이름·옵션·이미지·배송 설정 수정과 채널 연결은 상세 페이지에서 이어서 합니다.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(createdId))}>
              상세 페이지로 이동
            </Button>
            <Button variant="secondary" onClick={() => router.push(ROUTES.MASTER_PRODUCTS)}>
              마스터 목록으로
            </Button>
            <Button variant="secondary" onClick={handleAddAnother}>
              새 마스터 추가
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="판매상품 마스터 추가">
      <MasterProductCreateForm
        key={formKey}
        useCase={useCase}
        productsUseCase={productsUseCase}
        carrierRateUseCase={carrierRateUseCase}
        packageUseCase={packageUseCase}
        thumbnailTemplateUseCase={thumbnailTemplateUseCase}
        detailUseCase={detailUseCase}
        productImageUseCase={productImageUseCase}
        categoryUseCase={categoryUseCase}
        onCreated={handleCreated}
        onCreatedWithWarning={handleCreatedWithWarning}
        onCancel={handleCancel}
      />
    </PageContainer>
  );
}
