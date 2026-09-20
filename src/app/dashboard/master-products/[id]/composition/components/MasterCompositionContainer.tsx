'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { Product } from '@/domain/entities/Product';
import { MasterCompositionForm } from './MasterCompositionForm';

/**
 * 마스터 **구성상품 변경 페이지** 진입점 (2609_64).
 * File: src/app/dashboard/master-products/[id]/composition/components/MasterCompositionContainer.tsx
 *
 * 진입은 마스터 상세의 「옵션 (수량조합)」 헤더 [구성상품 변경] 버튼 하나다.
 *
 * ⚠️ 팝업이 아니라 페이지다(PLAN/D9) — 구성상품 검색·선택 + 옵션 × 구성상품 수량 격자는 긴 작업이다.
 * ⚠️ 비활성(삭제된) 마스터도 열려야 한다(PLAN/D11). `active === false` 로 막지 말 것 —
 *    잘못 만들어 지워둔 마스터의 구성을 고치는 것이 이 화면이 생긴 이유다.
 */
export function MasterCompositionContainer({ id }: { id: string }) {
  const router = useRouter();
  const masterId = Number(id);

  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);

  const [master, setMaster] = useState<MasterProductResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [loaded, productPage] = await Promise.all([
          useCase.getById(masterId),
          // ⚠️ getProducts 는 페이지 객체를 돌려준다 — 목록은 `.content` (생성 폼과 같다).
          productsUseCase.getProducts({ page: 0, size: 1000 }),
        ]);
        if (!alive) return;
        setMaster(loaded);
        setProducts(productPage.content);
      } catch (e: unknown) {
        if (alive) setError(extractErrorMessage(e, '마스터 정보를 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, productsUseCase, masterId]);

  return (
    <PageContainer title="구성상품 변경">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(masterId))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← 마스터 상세
          </button>
          {master && <span className="text-sm text-gray-900">{master.name}</span>}
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {master && !master.active && (
          <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            비활성(삭제됨) 마스터입니다.
          </p>
        )}

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : master ? (
          <MasterCompositionForm
            master={master}
            products={products}
            useCase={useCase}
            onSaved={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(masterId))}
            onCancel={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(masterId))}
          />
        ) : (
          !error && <p className="text-sm text-gray-500">표시할 마스터가 없습니다.</p>
        )}
      </Card>
    </PageContainer>
  );
}
