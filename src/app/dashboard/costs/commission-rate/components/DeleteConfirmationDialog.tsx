'use client';

import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  error,
}: DeleteConfirmationDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="삭제 확인"
      message={
        <>
          <p className="text-base">이 수수료 정보를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700 mt-6">
              {error}
            </div>
          )}
        </>
      }
      confirmText={isLoading ? '삭제 중...' : '삭제'}
      cancelText="취소"
      onConfirm={onConfirm}
      onCancel={onClose}
      isDangerous
      isLoading={isLoading}
    />
  );
}
