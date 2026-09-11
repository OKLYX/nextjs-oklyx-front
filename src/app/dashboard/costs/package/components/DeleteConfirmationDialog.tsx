'use client';

import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  packageName?: string;
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * 상자비 삭제 확인 — PackageDetailsModal 안에서 열리는 **중첩** 팝업이다.
 * 그래서 `nested` 로 부모 모달 위(z-[60])에 띄운다. 빼면 부모와 같은 층에 깔려 가려진다.
 */
export function DeleteConfirmationDialog({
  isOpen,
  packageName,
  isLoading,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="삭제 확인"
      message={
        <p className="text-sm text-gray-700">
          이 상자비를 삭제하시겠습니까?
          {packageName && <span className="block mt-1 font-medium">({packageName})</span>}
        </p>
      }
      confirmText={isLoading ? '삭제 중...' : '삭제'}
      cancelText="취소"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isDangerous
      isLoading={isLoading}
      nested
    />
  );
}
