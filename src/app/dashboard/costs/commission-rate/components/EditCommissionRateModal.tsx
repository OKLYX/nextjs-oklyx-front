'use client';

import { useEffect } from 'react';
import { CommissionRateForm } from './CommissionRateForm';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { UpdateCommissionRateFormData } from '@/application/schemas/CommissionRateSchema';

interface EditCommissionRateModalProps {
  isOpen: boolean;
  commissionRate: CommissionRate | null;
  onClose: () => void;
  onSubmit: (data: UpdateCommissionRateFormData) => Promise<void>;
  onOpenDeleteConfirm: () => void;
  isLoading: boolean;
  isDeletingRate: boolean;
}

export function EditCommissionRateModal({
  isOpen,
  commissionRate,
  onClose,
  onSubmit,
  onOpenDeleteConfirm,
  isLoading,
  isDeletingRate,
}: EditCommissionRateModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">수수료 수정</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {commissionRate && (
            <CommissionRateForm
              initialData={commissionRate}
              isLoading={isLoading}
              isDeletingRate={isDeletingRate}
              onSubmit={onSubmit}
              onCancel={onClose}
              onOpenDeleteConfirm={onOpenDeleteConfirm}
              submitButtonLabel="수정"
              submitLoadingLabel="수정 중..."
            />
          )}
        </div>
      </div>
    </div>
  );
}
