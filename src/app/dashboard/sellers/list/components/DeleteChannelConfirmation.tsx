'use client';

import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface DeleteChannelConfirmationProps {
  isOpen: boolean;
  channelLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Confirmation dialog for deleting a sales channel (MarketplaceAccount).
 * Mirrors DeleteSellerConfirmation's chrome and behavior.
 */
export function DeleteChannelConfirmation({
  isOpen,
  channelLabel,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteChannelConfirmationProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="삭제 확인"
      message={
        <div className="flex gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700">
              정말로 <span className="font-semibold">{channelLabel}</span> 판매채널을 삭제하시겠습니까?
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
