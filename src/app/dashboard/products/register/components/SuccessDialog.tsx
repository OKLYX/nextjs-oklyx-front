'use client';

import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface SuccessDialogProps {
  isOpen: boolean;
  onGoToList: () => void;
  onRegisterAnother: () => void;
}

/**
 * 상품 등록 완료 안내 — 다음 작업 두 가지 중 하나를 고른다.
 * 확인(오른쪽) = 목록으로, 취소(왼쪽) = 다른 상품 등록. ESC·바깥 클릭은 [다른 상품 등록]과 같다.
 */
export function SuccessDialog({ isOpen, onGoToList, onRegisterAnother }: SuccessDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="상품 등록 완료"
      message="상품이 등록되었습니다. 다음 작업을 선택해주세요."
      confirmText="상품 목록으로"
      cancelText="다른 상품 등록"
      onConfirm={onGoToList}
      onCancel={onRegisterAnother}
    />
  );
}
