'use client';

import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface DeleteSellerConfirmationProps {
  isOpen: boolean;
  sellerName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteSellerConfirmation({
  isOpen,
  sellerName,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteSellerConfirmationProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="삭제 확인"
      message={
        <div className="flex gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700">
              정말로 <span className="font-semibold">{sellerName}</span>을(를) 삭제하시겠습니까?
            </p>
            <p className="text-xs text-gray-500 mt-2">이 작업은 취소할 수 없습니다.</p>
          </div>
        </div>
      }
      confirmText={isLoading ? '삭제 중...' : '삭제'}
      cancelText="취소"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isDangerous
      isLoading={isLoading}
    />
  );
}
