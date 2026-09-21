'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { ProductRegistrationForm } from './ProductRegistrationForm';
import { SuccessDialog } from './SuccessDialog';

export function ProductRegistrationContainer() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageBuffer, setImageBuffer] = useState<File[]>([]);
  // 참고 패널에서 담은 마켓 사진 URL(FEATURE_2609_67). 물품이 만들어진 뒤 서버가 내려받아 붙인다.
  // 🔴 저장하지 않는다(localStorage·Zustand 금지) — 다음 물품에 새면 잘못된 사진이 붙는다.
  const [pickedImageUrls, setPickedImageUrls] = useState<string[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

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
      setError(null);

      try {
        const product = await useCase.createProduct(data);

        if (imageBuffer.length > 0) {
          try {
            // Backend `add` takes all files in one POST → no Promise.all needed.
            await imageUseCase.add(product.id, imageBuffer);
          } catch {
            // Product is already created; surface a non-blocking image warning.
            setError('상품은 등록되었으나 이미지 일부 업로드에 실패했습니다.');
          }
        }

        // 순서: 파일 업로드 → URL 복제. 둘 다 뒤에 붙으므로 이 순서가 곧 갤러리 순서다.
        if (pickedImageUrls.length > 0) {
          try {
            await imageUseCase.addFromUrls(product.id, pickedImageUrls);
          } catch {
            // 물품은 이미 만들어졌다 — 사진 실패는 막지 않고 알리기만 한다(위 이미지 처리와 같은 판단).
            setError('상품은 등록되었으나 가져온 사진 일부를 붙이지 못했습니다.');
          }
        }

        setShowSuccessDialog(true);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.removeToken();
          router.push(ROUTES.LOGIN);
          throw err;
        }

        let errorMessage = '상품 등록에 실패했습니다';
        if (axios.isAxiosError(err)) {
          errorMessage = (err.response?.data as any)?.message || err.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        setError(errorMessage);
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

  const handleRegisterAnother = useCallback(() => {
    setShowSuccessDialog(false);
    setImageBuffer([]);
    // 🔴 여기도 비운다 — 한 곳만 고치면 [계속 등록] 경로로 앞 물품의 사진이 다음 물품에 붙는다.
    setPickedImageUrls([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <PageContainer title="상품등록">
      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700 text-lg font-bold"
          >
            ×
          </button>
        </div>
      )}
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
      />
    </PageContainer>
  );
}
