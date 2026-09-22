'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { GetProductDetailUseCase } from '@/application/usecases/GetProductDetailUseCase';
import { GetProductUsageUseCase } from '@/application/usecases/GetProductUsageUseCase';
import { UpdateProductUseCase } from '@/application/usecases/UpdateProductUseCase';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { BarcodeExtractionUseCase } from '@/application/usecases/BarcodeExtractionUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { ProductUsageRepositoryImpl } from '@/infrastructure/repositories/ProductUsageRepositoryImpl';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { BarcodeExtractionRepositoryImpl } from '@/infrastructure/repositories/BarcodeExtractionRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import { detailHrefWithReturn, listReturnHref } from '@/infrastructure/utils/listReturn';
import type { Product } from '@/domain/entities/Product';
import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { ProductDetailView } from './ProductDetailView';
import { ProductEditForm } from './ProductEditForm';

interface ProductDetailContainerProps {
  id: number;
}

export function ProductDetailContainer({ id }: ProductDetailContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 연결 현황은 상세 본문과 **따로** 싣는다 — 실패해도 상세는 그대로 보여야 한다(FEATURE_2609_69 / A).
  const [usage, setUsage] = useState<ProductUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  const isEditMode = searchParams.get('mode') === 'edit';

  // 목록에서 실려 온 조회 조건. 수정 모드를 오갈 때도 잃지 않게 상세 URL 에 계속 달고 다닌다.
  const listQuery = searchParams.get('from') ?? '';
  const backHref = listReturnHref(ROUTES.PRODUCTS_RETRIEVE, searchParams);
  const detailHref = detailHrefWithReturn(ROUTES.PRODUCT_DETAIL(id), listQuery);
  const editHref = detailHrefWithReturn(ROUTES.PRODUCT_EDIT(id), listQuery);

  const getUseCase = useMemo(
    () => new GetProductDetailUseCase(new ProductRepositoryImpl()),
    []
  );

  const usageUseCase = useMemo(
    () => new GetProductUsageUseCase(new ProductUsageRepositoryImpl()),
    []
  );

  const updateUseCase = useMemo(
    () => new UpdateProductUseCase(new ProductRepositoryImpl()),
    []
  );

  const imageUseCase = useMemo(
    () => new ProductImageUseCase(new ProductImageRepositoryImpl()),
    []
  );

  const barcodeUseCase = useMemo(
    () => new BarcodeExtractionUseCase(new BarcodeExtractionRepositoryImpl()),
    []
  );

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUseCase.getProduct(id);
      setProduct(data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        tokenStorage.removeToken();
        router.push(ROUTES.LOGIN);
        return;
      }

      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Product not found');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch product';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, getUseCase, router]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  /**
   * 연결 현황 조회 (FEATURE_2609_69 / A).
   *
   * 🔴 삭제가 거부됐을 때(409) 다시 부른다 — 그새 연결이 생겼을 수 있다.
   * 🔴 실패해도 `error` 를 건드리지 않는다. 상세 본문은 그대로 보여야 한다.
   */
  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      setUsage(await usageUseCase.execute(id));
    } catch (err) {
      setUsage(null);
      setUsageError(extractErrorMessage(err, '연결 현황을 불러오지 못했습니다.'));
    } finally {
      setUsageLoading(false);
    }
  }, [id, usageUseCase]);

  // 프로젝트 표준 회피책 — 이펙트 본문에서 곧바로 setState 하면 lint `set-state-in-effect`(error) 다.
  useEffect(() => {
    void (async () => {
      await loadUsage();
    })();
  }, [loadUsage]);

  /**
   * 사진에서 읽어낸 바코드를 화면 값에만 반영한다 (FEATURE_2609_65).
   *
   * 🔴 여기서 `fetchProduct()` 를 부르지 말 것. `fetchProduct` 는 `setIsLoading(true)` 를 하고
   * 이 컨테이너는 `isLoading` 이면 화면 전체를 `StateBlock` 으로 바꾼다 → `ProductDetailView` 가
   * 언마운트돼 **방금 띄운 결과 알림이 사라진다**(성공했을 때만 알림이 안 보이는 최악의 동작).
   * 서버가 저장한 값은 응답에 이미 들어 있으니 그 값만 갈아 끼운다(`handleSave` 와 같은 방식).
   */
  const handleBarcodeExtracted = useCallback((barcode: string) => {
    setProduct((prev) => (prev ? { ...prev, barcodeId: barcode } : prev));
  }, []);

  const handleDelete = useCallback(async () => {
    await axiosInstance.delete(`/api/products/${id}`);
  }, [id]);

  const handleSave = useCallback(
    async (data: UpdateProductRequest) => {
      try {
        const updated = await updateUseCase.updateProduct(id, data);
        setProduct(updated);
        router.push(detailHref);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
        setError(errorMessage);
        throw err;
      }
    },
    [id, updateUseCase, router, detailHref]
  );

  const handleCancel = useCallback(() => {
    router.push(detailHref);
  }, [router, detailHref]);

  const handleCheckBarcode = useCallback(
    async (barcodeId: string) => {
      try {
        return await updateUseCase.checkBarcodeExists(barcodeId);
      } catch {
        return false;
      }
    },
    [updateUseCase]
  );

  // 로딩·에러·없음은 다른 화면과 같은 공용 조합이다: `Card padded={false}` + `StateBlock`.
  // 손으로 만든 빨간 박스·영어 문구로 되돌리지 말 것.
  if (isLoading) {
    return (
      <PageContainer title={isEditMode ? '상품 수정' : '상품 상세'}>
        <Card padded={false}>
          <StateBlock variant="loading" message="불러오는 중..." />
        </Card>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title={isEditMode ? '상품 수정' : '상품 상세'}>
        <Card padded={false}>
          <StateBlock variant="error" message={error} />
        </Card>
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer title={isEditMode ? '상품 수정' : '상품 상세'}>
        <Card padded={false}>
          <StateBlock variant="empty" message="상품을 찾을 수 없습니다." />
        </Card>
      </PageContainer>
    );
  }

  if (isEditMode) {
    return (
      <PageContainer title="상품 수정">
        <ProductEditForm
          product={product}
          onSave={handleSave}
          onCancel={handleCancel}
          onCheckBarcode={handleCheckBarcode}
          imageUseCase={imageUseCase}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="상품 상세">
      <ProductDetailView
        product={product}
        usage={usage}
        usageLoading={usageLoading}
        usageError={usageError}
        onReloadUsage={loadUsage}
        onDelete={handleDelete}
        imageUseCase={imageUseCase}
        barcodeUseCase={barcodeUseCase}
        onBarcodeExtracted={handleBarcodeExtracted}
        backHref={backHref}
        editHref={editHref}
      />
    </PageContainer>
  );
}
