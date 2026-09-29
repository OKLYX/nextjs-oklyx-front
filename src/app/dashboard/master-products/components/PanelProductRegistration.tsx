'use client';

import { useCallback, useState } from 'react';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import type { Product } from '@/domain/entities/Product';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { ProductRegistrationForm } from '@/app/dashboard/products/register/components/ProductRegistrationForm';
import { useProductRegistration } from '@/app/dashboard/products/register/components/useProductRegistration';

interface PanelProductRegistrationProps {
  /** 저장 성공 — 만든 물품을 넘긴다(패널이 알림·구성상품에 넣기·목록 복귀를 한다). */
  onCreated: (product: Product) => void;
  /** [취소] — 패널을 구성상품 목록으로 되돌린다. */
  onCancel: () => void;
}

/**
 * 왼쪽 물품 패널 안의 [새 물품 등록] 화면 (2609_78 / UX D62·D66) — 물품 등록 **전체 양식**.
 * File: src/app/dashboard/master-products/components/PanelProductRegistration.tsx
 *
 * 양식 = 물품 등록 페이지와 같은 `ProductRegistrationForm`(`embedded`), 저장 = 같은 `useProductRegistration`.
 * [취소] 는 작성 흔적이 있으면 「작성 취소」 확인을 띄운다(UX D32 — 저장 전 입력 버리기는 되돌릴 수 없는 지우기,
 * 마스터 생성 폼의 [취소] 와 같은 문구).
 *
 * ⚠️ 작성 흔적 = 양식의 react-hook-form `isDirty`(`onDirtyChange` — 도구 패널 [채우기]·구매처 체크 포함)
 *    이거나 사진·마켓 사진이 담겨 있음. DOM `input` 이벤트로 판정하지 말 것 — [채우기]는 이벤트를 내지 않는다.
 * ❌ 성공 알림·구성상품에 넣기를 여기서 하지 말 것 — `ProductRelationPanel` 이 한다.
 */
export function PanelProductRegistration({ onCreated, onCancel }: PanelProductRegistrationProps) {
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
  const [formDirty, setFormDirty] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const hasInput = formDirty || imageBuffer.length > 0 || pickedImageUrls.length > 0;

  const handleSubmit = useCallback(
    async (data: CreateProductRequest) => {
      const product = await submit(data);
      onCreated(product);
    },
    [submit, onCreated],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">새 물품 등록</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => (hasInput ? setCancelConfirmOpen(true) : onCancel())}
          disabled={isLoading}
        >
          취소
        </Button>
      </div>
      <ProductRegistrationForm
        embedded
        onDirtyChange={setFormDirty}
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
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        title="작성 취소"
        message="작성 중인 내용이 저장되지 않고 사라집니다. 나가시겠습니까?"
        confirmText="나가기"
        cancelText="계속 작성"
        isDangerous
        onConfirm={onCancel}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </div>
  );
}
