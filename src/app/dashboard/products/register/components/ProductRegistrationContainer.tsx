'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { ROUTES } from '@/config/routes';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import { ProductRegistrationForm } from './ProductRegistrationForm';
import { SuccessDialog } from './SuccessDialog';
import { useProductRegistration } from './useProductRegistration';

export function ProductRegistrationContainer() {
  const router = useRouter();
  // 저장 흐름(사진 버퍼 · 마켓 URL · 실패 알림)은 훅이 소유한다 — 왼쪽 물품 패널과 같은 것을 쓴다(2609_78).
  const {
    isLoading,
    imageBuffer,
    setImageBuffer,
    pickedImageUrls,
    setPickedImageUrls,
    imageUseCase,
    checkBarcode,
    submit,
    resetBuffers,
  } = useProductRegistration();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  // 방금 만든 물품 id — 완료 창의 [이 물품으로 마스터 만들기]가 쓴다(2609_77/D44).
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);

  const handleSubmit = useCallback(
    async (data: CreateProductRequest) => {
      const product = await submit(data);
      setCreatedProductId(product.id);
      setShowSuccessDialog(true);
    },
    [submit],
  );

  const handleGoToList = useCallback(() => {
    router.push(ROUTES.PRODUCTS_RETRIEVE);
  }, [router]);

  // 2609_77/D44·D38(가): 판매 상품 관리 마스터 화면을 이 물품이 구성상품으로 골라진 채로 연다.
  // 2609_78: 주소 키는 `productIds`(쉼표 목록) 하나다 — 마스터 바구니도 같은 키를 쓴다.
  const handleCreateMaster = useCallback(() => {
    if (createdProductId == null) return;
    router.push(`${ROUTES.MASTER_PRODUCT_NEW}?productIds=${createdProductId}`);
  }, [router, createdProductId]);

  const handleRegisterAnother = useCallback(() => {
    setShowSuccessDialog(false);
    setCreatedProductId(null);
    // 🔴 여기도 비운다 — 한 곳만 고치면 [계속 등록] 경로로 앞 물품의 사진이 다음 물품에 붙는다.
    resetBuffers();
  }, [resetBuffers]);

  return (
    <PageContainer title="상품등록">
      <ProductRegistrationForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        imageUseCase={imageUseCase}
        imageBuffer={imageBuffer}
        onImageBufferChange={setImageBuffer}
        onCheckBarcode={checkBarcode}
        onSubmitSuccess={resetBuffers}
        pickedImageUrls={pickedImageUrls}
        onPickedImageUrlsChange={setPickedImageUrls}
      />
      <SuccessDialog
        isOpen={showSuccessDialog}
        onGoToList={handleGoToList}
        onRegisterAnother={handleRegisterAnother}
        onCreateMaster={handleCreateMaster}
      />
    </PageContainer>
  );
}
