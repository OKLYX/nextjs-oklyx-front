'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { CreateProductUseCase } from '@/application/usecases/CreateProductUseCase';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import type { Product } from '@/domain/entities/Product';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { toast } from '@/infrastructure/stores/toastStore';

/**
 * 물품 등록 한 건의 상태·저장 흐름 (2609_78 에서 `ProductRegistrationContainer` 에서 추출).
 * File: src/app/dashboard/products/register/components/useProductRegistration.ts
 *
 * **용도**: `ProductRegistrationForm` 에 넘길 값(사진 버퍼 · 마켓 사진 URL · 바코드 중복 확인)과
 * 저장(`submit`)을 한 곳에서 소유한다. 쓰는 곳 = 물품 등록 페이지 · 판매 상품 관리 마스터의 왼쪽 물품 패널
 * [새 물품 등록](UX D62·D66) 두 곳 — 저장 순서·실패 알림이 두 곳에서 갈라지지 않게 하려고 뽑았다.
 *
 * **저장 순서**: 물품 생성 → 사진 파일 업로드 → 마켓 사진 URL 복제(이 순서가 갤러리 순서다).
 * 사진 실패는 물품 생성을 되돌리지 않고 실패 알림만 띄운다. 생성 실패는 서버 사유를 실패 알림으로 띄우고
 * **다시 던진다**(폼이 입력을 지우지 않게). 401 은 로그인으로 보낸다.
 *
 * @example
 * const reg = useProductRegistration();
 * const handleSubmit = async (data: CreateProductRequest) => {
 *   const product = await reg.submit(data);
 *   // 성공 뒤 할 일(완료 창 · 구성상품에 넣기)은 호출부가 정한다
 * };
 * <ProductRegistrationForm onSubmit={handleSubmit} isLoading={reg.isLoading} ... onSubmitSuccess={reg.resetBuffers} />
 *
 * 🔴 사진 버퍼·마켓 URL 을 localStorage·Zustand 에 저장하지 말 것 — 다음 물품에 새면 잘못된 사진이 붙는다.
 * ❌ 성공 알림·다음 화면 이동을 여기서 하지 말 것 — 호출부마다 다르다.
 */
export function useProductRegistration() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [imageBuffer, setImageBuffer] = useState<File[]>([]);
  // 참고 패널에서 담은 마켓 사진 URL(FEATURE_2609_67). 물품이 만들어진 뒤 서버가 내려받아 붙인다.
  const [pickedImageUrls, setPickedImageUrls] = useState<string[]>([]);

  const useCase = useMemo(() => new CreateProductUseCase(new ProductRepositoryImpl()), []);
  const imageUseCase = useMemo(() => new ProductImageUseCase(new ProductImageRepositoryImpl()), []);

  const checkBarcode = useCallback(
    async (barcodeId: string): Promise<boolean> => {
      try {
        return await useCase.checkBarcodeExists(barcodeId);
      } catch {
        return false;
      }
    },
    [useCase],
  );

  const submit = useCallback(
    async (data: CreateProductRequest): Promise<Product> => {
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

        return product;
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
    [useCase, imageUseCase, imageBuffer, pickedImageUrls, router],
  );

  // 🔴 사진 버퍼와 마켓 URL 은 **함께** 비운다 — 한쪽만 비우면 앞 물품의 사진이 다음 물품에 붙는다.
  const resetBuffers = useCallback(() => {
    setImageBuffer([]);
    setPickedImageUrls([]);
  }, []);

  return {
    isLoading,
    imageBuffer,
    setImageBuffer,
    pickedImageUrls,
    setPickedImageUrls,
    imageUseCase,
    checkBarcode,
    submit,
    resetBuffers,
  };
}
