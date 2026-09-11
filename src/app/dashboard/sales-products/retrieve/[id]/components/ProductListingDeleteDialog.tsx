'use client';

import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface ProductListingDeleteDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  listingId: number;
  listingName: string;
  error?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ProductListingDeleteDialog({
  isOpen,
  isLoading,
  listingName,
  error,
  onConfirm,
  onCancel,
}: ProductListingDeleteDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="판매상품 삭제"
      message={
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-gray-700 text-base">
              정말 삭제하시겠습니까?
              <br />
              <span className="font-semibold">{listingName}</span>
            </p>
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              ⚠️ 삭제된 데이터는 복구할 수 없습니다.
            </p>
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
