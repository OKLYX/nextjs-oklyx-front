'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { CreateProductUseCase } from '@/application/usecases/CreateProductUseCase';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { toast } from '@/infrastructure/stores/toastStore';
import { ProductRegistrationForm } from './ProductRegistrationForm';
import { SuccessDialog } from './SuccessDialog';

export function ProductRegistrationContainer() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [imageBuffer, setImageBuffer] = useState<File[]>([]);
  // 참고 패널에서 담은 마켓 사진 URL(FEATURE_2609_67). 물품이 만들어진 뒤 서버가 내려받아 붙인다.
  // 🔴 저장하지 않는다(localStorage·Zustand 금지) — 다음 물품에 새면 잘못된 사진이 붙는다.
  const [pickedImageUrls, setPickedImageUrls] = useState<string[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  // 방금 만든 물품 id — 완료 창의 [이 물품으로 마스터 만들기]가 쓴다(2609_77/D44).
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);

  const useCase = useMemo(
    () => new CreateProductUseCase(new ProductRepositoryImpl()),
    []
  );

  const imageUseCase = useMemo(
    () => new ProductImageUseCase(new ProductImageRepositoryImpl()),
    []
  );

  const handleCheckBarcode = useCallback(async (barcodeId: string): Promise<boolean> => {
    try {
      return await useCase.checkBarcodeExists(barcodeId);
    } catch {
      return false;
    }
  }, [useCase]);

  const handleSubmit = useCallback(
    async (data: CreateProductRequest) => {
      setIsLoading(true);

      try {
        const product = await useCase.createProduct(data);

        if (imageBuffer.length > 0) {
          try {
            // Backend `add` takes all files in one POST → no Promise.all needed.
            await imageUseCase.add(product.id, imageBuffer);
          } catch {
            // Product is already created; surface a non-blocking image warning.
            toast.error('상품은 등록되었으나 이미지 일부 업로드에 실패했습니다.');
          }
        }

        // 순서: 파일 업로드 → URL 복제. 둘 다 뒤에 붙으므로 이 순서가 곧 갤러리 순서다.
        if (pickedImageUrls.length > 0) {
          try {
            await imageUseCase.addFromUrls(product.id, pickedImageUrls);
          } catch {
            // 물품은 이미 만들어졌다 — 사진 실패는 막지 않고 알리기만 한다(위 이미지 처리와 같은 판단).
            toast.error('상품은 등록되었으나 가져온 사진 일부를 붙이지 못했습니다.');
          }
        }

        setCreatedProductId(product.id);
        setShowSuccessDialog(true);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.removeToken();
          router.push(ROUTES.LOGIN);
          throw err;
        }

        // 백엔드 사유(단위 누락·바코드 중복 등)를 그대로 잠깐 알림(실패 6초)으로 띄운다(UX D26·D33).
        toast.error(extractErrorMessage(err, '상품 등록에 실패했습니다'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    // 🔴 pickedImageUrls 가 빠지면 콜백이 최초의 빈 배열을 가둔 채 굳어, 담은 사진이 아무 에러 없이
    //    안 올라간다.
    [useCase, imageUseCase, imageBuffer, pickedImageUrls, router]
  );

  const handleSubmitSuccess = useCallback(() => {
    setImageBuffer([]);
    setPickedImageUrls([]);
  }, []);

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
    setImageBuffer([]);
    // 🔴 여기도 비운다 — 한 곳만 고치면 [계속 등록] 경로로 앞 물품의 사진이 다음 물품에 붙는다.
    setPickedImageUrls([]);
  }, []);

  return (
    <PageContainer title="상품등록">
      <ProductRegistrationForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        imageUseCase={imageUseCase}
        imageBuffer={imageBuffer}
        onImageBufferChange={setImageBuffer}
        onCheckBarcode={handleCheckBarcode}
        onSubmitSuccess={handleSubmitSuccess}
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
